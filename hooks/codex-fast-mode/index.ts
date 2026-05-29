import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { AD_MODEL_FAST_MODE_CHANGED_EVENT } from "@harness/events";

let enabled = true;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const PRIORITY_MODELS = new Set([
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3",
  "gpt-5.4-codex",
  "gpt-5.3-codex",
]);

function isSupportedModel(model: string): boolean {
  return PRIORITY_MODELS.has(model);
}

export default function codexFastModeHook(pi: ExtensionAPI): void {
  function emit(pi: ExtensionAPI, ctx: ExtensionContext): void {
    pi.events.emit(AD_MODEL_FAST_MODE_CHANGED_EVENT, {
      provider: "openai-codex",
      enabled: ctx.model?.provider === "openai-codex" ? enabled : false,
    });
  }

  pi.registerCommand("codex:fast", {
    description: "Toggle Codex fast mode (priority service tier)",
    handler: async (_args, ctx) => {
      enabled = !enabled;
      emit(pi, ctx);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    emit(pi, ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    emit(pi, ctx);
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!enabled || !isRecord(event.payload)) return;
    if (ctx.model?.provider !== "openai-codex") return;

    const model = event.payload.model;
    if (typeof model !== "string" || !isSupportedModel(model)) return;
    if (Object.hasOwn(event.payload, "service_tier")) return;

    return { ...event.payload, service_tier: "priority" };
  });
}
