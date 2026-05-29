import { streamSimpleAnthropic } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { AD_MODEL_FAST_MODE_CHANGED_EVENT } from "@harness/events";

type AnthropicModel = Parameters<typeof streamSimpleAnthropic>[0];

const FAST_MODE_BETA = "fast-mode-2026-02-01";
const CLAUDE_CODE_BETAS = ["claude-code-20250219", "oauth-2025-04-20"];

const OPUS_FAST_MODELS = new Set([
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedModel(model: string): boolean {
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

export default function opusFastModeHook(pi: ExtensionAPI): void {
  let enabled = true;

  function emit(ctx: ExtensionContext): void {
    pi.events.emit(AD_MODEL_FAST_MODE_CHANGED_EVENT, {
      provider: "anthropic",
      enabled: ctx.model?.provider === "anthropic" ? enabled : false,
    });
  }

  pi.registerProvider("anthropic", {
    api: "anthropic-messages",
    streamSimple(model, context, options) {
      const anthropicModel = model as AnthropicModel;

      if (!enabled || !isSupportedModel(model.id)) {
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

      return streamSimpleAnthropic(anthropicModel, context, {
        ...options,
        headers,
      });
    },
  });

  pi.registerCommand("opus:fast", {
    description: "Toggle Opus fast mode (speed=fast)",
    handler: async (_args, ctx) => {
      enabled = !enabled;
      emit(ctx);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    emit(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    emit(ctx);
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!enabled || !isRecord(event.payload)) return;
    if (ctx.model?.provider !== "anthropic") return;

    const model = event.payload.model;
    if (typeof model !== "string" || !isSupportedModel(model)) return;
    if (Object.hasOwn(event.payload, "speed")) return;

    return { ...event.payload, speed: "fast" };
  });
}
