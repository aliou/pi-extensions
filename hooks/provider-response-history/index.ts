import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isAnthropicOverageInUse, parseAnthropicHeaders } from "./anthropic";
import { parseCodexHeaders } from "./codex";
import { parseSyntheticHeaders } from "./synthetic";
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
    ...parseSyntheticHeaders(headers, at),
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

export default function providerResponseHistoryHook(pi: ExtensionAPI): void {
  const extraUsageSessions = new Set<string>();

  pi.on("after_provider_response", async (event, ctx) => {
    const now = Date.now();
    const lines = historyLinesFromHeaders(event.headers, now);
    await appendHistoryLines(lines, now);

    const sessionId = ctx.sessionManager.getSessionId();
    if (
      ctx.model?.provider === "anthropic" &&
      !extraUsageSessions.has(sessionId) &&
      isAnthropicOverageInUse(event.headers)
    ) {
      extraUsageSessions.add(sessionId);
      emitExtraUsageUsed(pi, ctx, "anthropic", now);
    }
  });

  pi.on("session_start", () => {
    extraUsageSessions.clear();
  });

  pi.on("session_shutdown", () => {
    extraUsageSessions.clear();
  });
}
