import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  getCachedProvider,
  type ProviderSnapshot,
  writeProviderCache,
} from "@harness/provider-usage";
import { isAnthropicOverageInUse, parseAnthropicHeaders } from "./anthropic";
import { parseCodexHeaders } from "./codex";
import {
  NEURALWATT_QUOTAS_REQUEST_EVENT,
  NEURALWATT_QUOTAS_UPDATED_EVENT,
  updateNeuralwattCache,
} from "./neuralwatt-cache";
import { updateProviderCachesFromHistory } from "./provider-cache";
import {
  SYNTHETIC_QUOTAS_REQUEST_EVENT,
  SYNTHETIC_QUOTAS_UPDATED_EVENT,
  updateSyntheticCache,
} from "./synthetic-cache";
import {
  type HistoryLine,
  PROVIDER_EXTRA_USAGE_USED_EVENT,
  type ProviderExtraUsageUsedPayload,
} from "./types";

const HISTORY_DIR = join(
  process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
  "pi",
  "providers",
  "history",
);

function bucketName(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const bucket = Math.floor(d.getUTCHours() / 6) * 6;
  const h = String(bucket).padStart(2, "0");
  return `${y}-${m}-${day}-${h}.jsonl`;
}

function currentBucketPath(now: number): string {
  return join(HISTORY_DIR, bucketName(now));
}

function historyLinesFromHeaders(
  headers: Record<string, string> | undefined,
  at: number,
): HistoryLine[] {
  return [
    ...parseAnthropicHeaders(headers, at),
    ...parseCodexHeaders(headers, at),
  ];
}

async function appendHistoryLines(lines: HistoryLine[], now: number) {
  if (lines.length === 0) return;

  await mkdir(HISTORY_DIR, { recursive: true });
  await appendFile(
    currentBucketPath(now),
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    "utf-8",
  );
}

function emitExtraUsageUsed(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  provider: string,
  at: number,
): void {
  pi.events.emit(PROVIDER_EXTRA_USAGE_USED_EVENT, {
    provider,
    sessionId: ctx.sessionManager.getSessionId(),
    at,
  } satisfies ProviderExtraUsageUsedPayload);
}

async function setAnthropicExtraUsageActive(active: boolean): Promise<void> {
  const cached = await getCachedProvider("anthropic");
  // No point creating an empty cache just to store active=false.
  if (!cached && !active) return;
  const snapshot: ProviderSnapshot = cached ?? {
    provider: "anthropic",
    displayName: "Claude",
    status: "unknown",
    limits: [],
    fetchedAt: new Date(),
  };
  await writeProviderCache("anthropic", {
    ...snapshot,
    limits: snapshot.limits.filter((l) => l.id !== "anthropic:extra-usage"),
    extraUsageActive: active,
  });
}

export default function providerResponseHistoryHook(pi: ExtensionAPI): void {
  const extraUsageSessions = new Set<string>();

  pi.on("after_provider_response", async (event, ctx) => {
    const now = Date.now();
    const lines = historyLinesFromHeaders(event.headers, now);
    await Promise.all([
      appendHistoryLines(lines, now),
      updateProviderCachesFromHistory(lines, now),
    ]);

    const sessionId = ctx.sessionManager.getSessionId();
    if (
      ctx.model?.provider === "anthropic" &&
      !extraUsageSessions.has(sessionId) &&
      isAnthropicOverageInUse(event.headers)
    ) {
      extraUsageSessions.add(sessionId);
      emitExtraUsageUsed(pi, ctx, "anthropic", now);
      setAnthropicExtraUsageActive(true).catch(() => {}); // non-critical cache write
    }
  });

  pi.on("session_start", (_event, ctx) => {
    extraUsageSessions.clear();
    if (ctx.model?.provider === "anthropic") {
      // Reset overage flag on new session — it will be re-activated if overage
      // headers are still present.
      setAnthropicExtraUsageActive(false).catch(() => {}); // non-critical cache write
    }
    if (ctx.model?.provider === "neuralwatt") {
      pi.events.emit(NEURALWATT_QUOTAS_REQUEST_EVENT, {
        authStorage: ctx.modelRegistry.authStorage,
      });
    }
    if (ctx.model?.provider === "synthetic") {
      setTimeout(() => {
        pi.events.emit(SYNTHETIC_QUOTAS_REQUEST_EVENT, undefined);
      }, 0);
    }
  });

  // Emitted by @aliou/pi-neuralwatt after API or response-header quota updates.
  // Writes cache, then emits usage-cache:updated so consumers know data is ready.
  pi.events.on(NEURALWATT_QUOTAS_UPDATED_EVENT, (data: unknown) => {
    updateNeuralwattCache(data)
      .then(() => pi.events.emit("neuralwatt:usage-cache:updated", undefined))
      .catch(() => {});
  });

  // Emitted by @aliou/pi-synthetic after API or response-header quota updates.
  // Writes cache, then emits usage-cache:updated so consumers know data is ready.
  pi.events.on(SYNTHETIC_QUOTAS_UPDATED_EVENT, (data: unknown) => {
    updateSyntheticCache(data)
      .then(() => pi.events.emit("synthetic:usage-cache:updated", undefined))
      .catch(() => {});
  });

  pi.on("session_shutdown", () => {
    extraUsageSessions.clear();
  });
}
