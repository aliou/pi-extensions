import { streamSimpleAnthropic } from "@earendil-works/pi-ai/anthropic";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  AD_MODEL_FAST_MODE_CHANGED_EVENT,
  once,
} from "@harness/events";

// --- Codex fast mode ---

let codexEnabled = true;

const CODEX_PRIORITY_MODELS = new Set([
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3",
  "gpt-5.4-codex",
  "gpt-5.3-codex",
]);

function isCodexSupportedModel(model: string): boolean {
  return CODEX_PRIORITY_MODELS.has(model);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emitCodex(pi: ExtensionAPI, ctx: ExtensionContext): void {
  pi.events.emit(AD_MODEL_FAST_MODE_CHANGED_EVENT, {
    provider: "openai-codex",
    enabled: ctx.model?.provider === "openai-codex" ? codexEnabled : false,
  });
}

// --- Opus fast mode ---

type AnthropicModel = Parameters<typeof streamSimpleAnthropic>[0];

const FAST_MODE_BETA = "fast-mode-2026-02-01";
const CLAUDE_CODE_BETAS = ["claude-code-20250219", "oauth-2025-04-20"];

const OPUS_FAST_MODELS = new Set([
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
]);

function isOpusSupportedModel(model: string): boolean {
  return OPUS_FAST_MODELS.has(model);
}

function isOAuthToken(apiKey: string | undefined): boolean {
  return apiKey?.includes("sk-ant-oat") === true;
}

function getHeader(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  return key ? headers[key] : undefined;
}

function withoutHeader(
  headers: Record<string, string> | undefined,
  name: string,
): Record<string, string> {
  if (!headers) return {};
  const lower = name.toLowerCase();
  return Object.fromEntries(
    Object.entries(headers).filter(([k]) => k.toLowerCase() !== lower),
  );
}

function appendBetas(...values: Array<string | undefined>): string {
  const betas = new Set<string>();
  for (const value of values) {
    for (const beta of value?.split(",") ?? []) {
      const trimmed = beta.trim();
      if (trimmed) betas.add(trimmed);
    }
  }
  betas.add(FAST_MODE_BETA);
  return [...betas].join(",");
}

function addOpusFastModePayload(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;

  const model = payload.model;
  if (typeof model !== "string" || !isOpusSupportedModel(model)) return payload;
  if (Object.hasOwn(payload, "speed")) return payload;

  return { ...payload, speed: "fast" };
}

let opusEnabled = true;

function emitOpus(pi: ExtensionAPI, ctx: ExtensionContext): void {
  pi.events.emit(AD_MODEL_FAST_MODE_CHANGED_EVENT, {
    provider: "anthropic",
    enabled: ctx.model?.provider === "anthropic" ? opusEnabled : false,
  });
}

// --- Extension entry point ---

export default function fastModeHook(pi: ExtensionAPI): void {
  // Codex fast mode command
  pi.registerCommand("fast:codex", {
    description: "Toggle Codex fast mode (priority service tier)",
    handler: async (_args, ctx) => {
      codexEnabled = !codexEnabled;
      emitCodex(pi, ctx);
    },
  });

  // Opus fast mode command
  pi.registerCommand("fast:opus", {
    description: "Toggle Opus fast mode (speed=fast)",
    handler: async (_args, ctx) => {
      opusEnabled = !opusEnabled;
      emitOpus(pi, ctx);
    },
  });

  // Opus provider override (stream wrapper)
  pi.registerProvider("anthropic", {
    api: "anthropic-messages",
    streamSimple(model, context, options) {
      const anthropicModel = model as AnthropicModel;

      if (!opusEnabled || !isOpusSupportedModel(model.id)) {
        return streamSimpleAnthropic(anthropicModel, context, options);
      }

      const incoming = getHeader(options?.headers, "anthropic-beta");
      const base = isOAuthToken(options?.apiKey)
        ? CLAUDE_CODE_BETAS.join(",")
        : undefined;
      const headers = {
        ...withoutHeader(options?.headers, "anthropic-beta"),
        "anthropic-beta": appendBetas(base, incoming),
      };

      const onPayload = options?.onPayload;

      return streamSimpleAnthropic(anthropicModel, context, {
        ...options,
        headers,
        async onPayload(payload, payloadModel) {
          const fastPayload = addOpusFastModePayload(payload);
          if (!onPayload) return fastPayload;

          const nextPayload = await onPayload(fastPayload, payloadModel);
          return nextPayload === undefined ? fastPayload : nextPayload;
        },
      });
    },
  });

  // Lifecycle events
  pi.on("session_start", async (_event, ctx) => {
    emitCodex(pi, ctx);
    emitOpus(pi, ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    emitCodex(pi, ctx);
    emitOpus(pi, ctx);
  });

  // Codex: inject service_tier into provider request
  pi.on("before_provider_request", (event, ctx) => {
    if (!codexEnabled || !isRecord(event.payload)) return;
    if (ctx.model?.provider !== "openai-codex") return;

    const model = event.payload.model;
    if (typeof model !== "string" || !isCodexSupportedModel(model)) return;
    if (Object.hasOwn(event.payload, "service_tier")) return;

    return { ...event.payload, service_tier: "priority" };
  });

  // Header registration
  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "fast:[opus/codex]",
      description: "toggle fast mode",
    });
  });
}
