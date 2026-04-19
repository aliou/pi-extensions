import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  AD_PALETTE_READY_EVENT,
  AD_PALETTE_REGISTER_EVENT,
  AD_PROVIDERS_CODEX_VERBOSITY_CHANGED_EVENT,
  AD_PROVIDERS_CODEX_VERBOSITY_READY_EVENT,
  AD_PROVIDERS_CODEX_VERBOSITY_REQUEST_EVENT,
  type AdProvidersCodexVerbosityChangedEvent,
} from "../../../../packages/events";

export type CodexVerbosity = "low" | "medium" | "high";

const PALETTE_REGISTER = AD_PALETTE_REGISTER_EVENT;
const CODEX_VERBOSITY_READY_EVENT = AD_PROVIDERS_CODEX_VERBOSITY_READY_EVENT;
const CODEX_VERBOSITY_REQUEST_EVENT =
  AD_PROVIDERS_CODEX_VERBOSITY_REQUEST_EVENT;
const CODEX_VERBOSITY_CHANGED_EVENT =
  AD_PROVIDERS_CODEX_VERBOSITY_CHANGED_EVENT;

let codexVerbosity: CodexVerbosity | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOpenAICodexProvider(ctx: ExtensionContext): boolean {
  return ctx.model?.provider === "openai-codex";
}

// Source: OpenAI Priority docs/pricing (2025/2026).
// Keep explicit allowlist to avoid cross-provider payload mutation.
const OPENAI_CODEX_COMPAT_MODELS = new Set([
  "gpt-5.4",
  "gpt-5.3",
  "gpt-5.4-codex",
  "gpt-5.3-codex",
]);

function isSupportedCodexCompatModel(model: string): boolean {
  if (OPENAI_CODEX_COMPAT_MODELS.has(model)) return true;

  // Allow dated snapshots for the same base IDs.
  for (const base of OPENAI_CODEX_COMPAT_MODELS) {
    if (model.startsWith(`${base}-`)) return true;
  }

  return false;
}

function isPayloadTargetingSupportedCodexCompatModel(
  payload: unknown,
): boolean {
  if (!isRecord(payload)) return false;
  const model = payload.model;
  return typeof model === "string" && isSupportedCodexCompatModel(model);
}

function emitCodexVerbosityState(pi: ExtensionAPI): void {
  const payload: AdProvidersCodexVerbosityChangedEvent = {
    verbosity: codexVerbosity,
  };
  pi.events.emit(CODEX_VERBOSITY_CHANGED_EVENT, payload);
}

function notifyCodexVerbosityState(
  ctx: ExtensionContext,
  verbosity: CodexVerbosity | undefined,
): void {
  if (!ctx.hasUI) return;

  if (!verbosity) {
    ctx.ui.notify(
      "Codex verbosity override cleared for this conversation.",
      "info",
    );
    return;
  }

  if (isOpenAICodexProvider(ctx)) {
    ctx.ui.notify(
      `Codex verbosity set to ${verbosity} for this conversation.`,
      "info",
    );
    return;
  }

  ctx.ui.notify(
    `Codex verbosity set to ${verbosity}. It will apply when you switch to a Codex model in this conversation.`,
    "info",
  );
}

function setCodexVerbosity(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  verbosity: CodexVerbosity | undefined,
  options?: { notify?: boolean },
): void {
  codexVerbosity = verbosity;
  emitCodexVerbosityState(pi);

  if (options?.notify !== false) {
    notifyCodexVerbosityState(ctx, verbosity);
  }
}

function emitPaletteRegistration(pi: ExtensionAPI): void {
  pi.events.emit(PALETTE_REGISTER, {
    id: "providers.codex-verbosity.select",
    title: "Set Codex verbosity",
    description: "Choose low, medium, high, or default",
    keywords: [
      "codex",
      "verbosity",
      "low",
      "medium",
      "high",
      "default",
      "providers",
    ],
    group: "model",
    input: {
      type: "pick",
      title: "Set Codex verbosity",
      items: [
        {
          value: "default",
          label: "Default",
          description: "Use provider default verbosity",
          keywords: "clear off unset reset default",
        },
        {
          value: "low",
          label: "Low",
          description: "Send text.verbosity=low",
          keywords: "quiet concise brief",
        },
        {
          value: "medium",
          label: "Medium",
          description: "Send text.verbosity=medium",
          keywords: "normal balanced",
        },
        {
          value: "high",
          label: "High",
          description: "Send text.verbosity=high",
          keywords: "verbose detailed",
        },
      ],
    },
    isEnabled: (c: { ctx: ExtensionContext }) => {
      if (c.ctx.model?.provider !== "openai-codex") {
        return {
          enabled: false,
          reason: "Requires a Codex model",
        };
      }

      return true;
    },
    execute: async (ctx: ExtensionContext, input?: string) => {
      if (!input) return;

      if (input === "default") {
        setCodexVerbosity(pi, ctx, undefined);
        return;
      }

      if (input === "low" || input === "medium" || input === "high") {
        setCodexVerbosity(pi, ctx, input);
      }
    },
  });
}

export function setupCodexVerbosityHooks(pi: ExtensionAPI): void {
  emitPaletteRegistration(pi);
  pi.events.on(AD_PALETTE_READY_EVENT, () => {
    emitPaletteRegistration(pi);
  });

  pi.events.on(CODEX_VERBOSITY_REQUEST_EVENT, () => {
    emitCodexVerbosityState(pi);
  });

  pi.on("session_start", async () => {
    codexVerbosity = undefined;
    pi.events.emit(CODEX_VERBOSITY_READY_EVENT, {});
    emitCodexVerbosityState(pi);
  });

  pi.on("model_select", async () => {
    emitCodexVerbosityState(pi);
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!codexVerbosity || !isRecord(event.payload)) {
      return;
    }

    // Guard on actual payload model first to avoid cross-provider leaks.
    if (!isPayloadTargetingSupportedCodexCompatModel(event.payload)) {
      return;
    }

    if (!isOpenAICodexProvider(ctx)) {
      return;
    }

    const text = isRecord(event.payload.text) ? event.payload.text : {};

    return {
      ...event.payload,
      text: {
        ...text,
        verbosity: codexVerbosity,
      },
    };
  });
}
