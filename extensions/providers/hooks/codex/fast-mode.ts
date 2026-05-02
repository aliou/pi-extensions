import {
  AD_PROVIDERS_CODEX_FAST_MODE_CHANGED_EVENT,
  AD_PROVIDERS_CODEX_FAST_MODE_READY_EVENT,
  AD_PROVIDERS_CODEX_FAST_MODE_REQUEST_EVENT,
} from "@harness/events";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  CODEX_FAST_ENTRY_TYPE,
  DEFAULT_CODEX_FAST_MODE_ENABLED,
  readCodexFastModeState,
} from "../../lib/codex-fast-mode";

const CODEX_FAST_MODE_READY_EVENT = AD_PROVIDERS_CODEX_FAST_MODE_READY_EVENT;
const CODEX_FAST_MODE_REQUEST_EVENT =
  AD_PROVIDERS_CODEX_FAST_MODE_REQUEST_EVENT;
const CODEX_FAST_MODE_CHANGED_EVENT =
  AD_PROVIDERS_CODEX_FAST_MODE_CHANGED_EVENT;

let fastModeEnabled = DEFAULT_CODEX_FAST_MODE_ENABLED;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOpenAICodexProvider(ctx: ExtensionContext): boolean {
  return ctx.model?.provider === "openai-codex";
}

// Source: OpenAI Priority docs/pricing (2025/2026).
// Keep explicit allowlist to avoid cross-provider/service-tier leaks.
// Includes current GPT-5 line (incl. 5.4) and codex variants, plus 5.3 used in local sessions.
const OPENAI_MODELS_WITH_PRIORITY_SERVICE_TIER = new Set([
  "gpt-5.4",
  "gpt-5.3",
  "gpt-5.4-codex",
  "gpt-5.3-codex",
]);

function isSupportedPriorityModel(model: string): boolean {
  if (OPENAI_MODELS_WITH_PRIORITY_SERVICE_TIER.has(model)) return true;

  // Allow dated snapshots for the same base IDs.
  for (const base of OPENAI_MODELS_WITH_PRIORITY_SERVICE_TIER) {
    if (model.startsWith(`${base}-`)) return true;
  }

  return false;
}

function isPayloadTargetingSupportedPriorityModel(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const model = payload.model;
  return typeof model === "string" && isSupportedPriorityModel(model);
}

function emitFastModeState(pi: ExtensionAPI, ctx: ExtensionContext): void {
  pi.events.emit(CODEX_FAST_MODE_CHANGED_EVENT, {
    enabled: isOpenAICodexProvider(ctx) ? fastModeEnabled : false,
  });
}

function readFastModeState(ctx: ExtensionContext): boolean {
  return readCodexFastModeState(ctx);
}

function persistFastModeState(pi: ExtensionAPI, enabled: boolean): void {
  pi.appendEntry(CODEX_FAST_ENTRY_TYPE, { enabled });
}

function notifyFastModeState(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;

  if (!fastModeEnabled) {
    ctx.ui.notify(
      "Codex fast mode disabled. OpenAI Codex requests will use the default service tier.",
      "info",
    );
    return;
  }

  if (isOpenAICodexProvider(ctx)) {
    ctx.ui.notify(
      "Codex fast mode enabled. OpenAI Codex requests will send service_tier=priority.",
      "info",
    );
    return;
  }

  ctx.ui.notify(
    "Codex fast mode enabled. It will apply when you switch to an OpenAI Codex model.",
    "info",
  );
}

function setFastMode(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  enabled: boolean,
  options?: { notify?: boolean; persist?: boolean },
): void {
  fastModeEnabled = enabled;

  if (options?.persist !== false) {
    persistFastModeState(pi, enabled);
  }

  emitFastModeState(pi, ctx);

  if (options?.notify !== false) {
    notifyFastModeState(ctx);
  }
}

export function setupCodexFastModeHooks(pi: ExtensionAPI): void {
  pi.registerCommand("providers:codex-fast", {
    description: "Toggle Codex fast mode (priority service tier)",
    handler: async (_args, ctx) => {
      setFastMode(pi, ctx, !fastModeEnabled);
    },
  });

  pi.events.on(CODEX_FAST_MODE_REQUEST_EVENT, (data: unknown) => {
    const event = (data ?? {}) as { ctx?: ExtensionContext };
    if (!event.ctx) return;
    emitFastModeState(pi, event.ctx);
  });

  pi.on("session_start", async (_event, ctx) => {
    fastModeEnabled = readFastModeState(ctx);
    pi.events.emit(CODEX_FAST_MODE_READY_EVENT, {});
  });

  pi.on("model_select", async (event, ctx) => {
    emitFastModeState(pi, ctx);

    if (!ctx.hasUI) return;
    if (event.source === "restore") return;
    if (event.model.provider !== "openai-codex") return;
    if (event.previousModel?.provider === "openai-codex") return;

    const suffix = fastModeEnabled ? " Fast mode is currently enabled." : "";
    ctx.ui.notify(
      `Codex fast mode is available for this model.${suffix}`,
      "info",
    );
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!fastModeEnabled || !isRecord(event.payload)) {
      return;
    }

    // Guard on the actual serialized payload model first.
    // ctx.model can be temporarily stale around model/provider transitions.
    if (!isPayloadTargetingSupportedPriorityModel(event.payload)) {
      return;
    }

    // Keep legacy provider check as a second safety gate.
    if (!isOpenAICodexProvider(ctx)) {
      return;
    }

    if (Object.hasOwn(event.payload, "service_tier")) {
      return;
    }

    return {
      ...event.payload,
      service_tier: "priority",
    };
  });
}
