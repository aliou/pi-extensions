import { getApiProvider } from "@earendil-works/pi-ai/compat";
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

import {
  createAnthropicFastModeStreamSimple,
  isAnthropicSupportedModel,
} from "./anthropic";
import {
  type CodexRequestPayload,
  injectCodexServiceTier,
  isCodexSupportedModel,
} from "./codex";

let codexEnabled = true;
let anthropicEnabled = true;

function emitCodexFastMode(pi: ExtensionAPI, ctx: ExtensionContext): void {
  const enabled =
    codexEnabled &&
    ctx.model?.provider === "openai-codex" &&
    isCodexSupportedModel(ctx.model?.id ?? "");
  pi.events.emit(AD_MODEL_FAST_MODE_CHANGED_EVENT, {
    provider: "openai-codex",
    enabled,
  });
}

function emitAnthropicFastMode(pi: ExtensionAPI, ctx: ExtensionContext): void {
  const enabled =
    anthropicEnabled &&
    ctx.model?.provider === "anthropic" &&
    isAnthropicSupportedModel(ctx.model?.id ?? "");
  pi.events.emit(AD_MODEL_FAST_MODE_CHANGED_EVENT, {
    provider: "anthropic",
    enabled,
  });
}

// TODO: merge `/fast` and `/fast:codex` into a single `/fast` command backed by
// an interactive multi-select UI (checkboxes) listing each provider (anthropic,
// codex, ...) and letting the user toggle fast mode per provider. Reuse the
// checkbox select component pattern from
// `packages/coding-agent/src/modes/interactive/components/config-selector.ts`
// (or whatever pi-tui multi-select primitive that lives in) rather than rolling
// a custom one. Today each provider has its own `/fast:<provider>` command.

export default function fastModeHook(pi: ExtensionAPI): void {
  pi.registerCommand("fast", {
    description: "Toggle Anthropic fast mode (speed=fast)",
    handler: async (_args, ctx) => {
      anthropicEnabled = !anthropicEnabled;
      emitAnthropicFastMode(pi, ctx);
    },
  });

  pi.registerCommand("fast:codex", {
    description: "Toggle Codex fast mode (priority service tier)",
    handler: async (_args, ctx) => {
      codexEnabled = !codexEnabled;
      emitCodexFastMode(pi, ctx);
    },
  });

  // Anthropic fast mode needs to add request headers, which the current Pi
  // extension API cannot mutate directly. Wrap its stream implementation for
  // that header; request-payload changes use before_provider_request below.
  const anthropicBuiltIn = getApiProvider("anthropic-messages");
  if (anthropicBuiltIn?.streamSimple) {
    pi.registerProvider("anthropic", {
      api: "anthropic-messages",
      streamSimple: createAnthropicFastModeStreamSimple(
        anthropicBuiltIn.streamSimple,
        () => anthropicEnabled,
      ),
    });
  }

  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== "openai-codex") return;

    return injectCodexServiceTier(
      event.payload as CodexRequestPayload,
      codexEnabled,
    );
  });

  pi.on("session_start", async (_event, ctx) => {
    emitCodexFastMode(pi, ctx);
    emitAnthropicFastMode(pi, ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    emitCodexFastMode(pi, ctx);
    emitAnthropicFastMode(pi, ctx);
  });

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "fast / fast:codex",
      description: "toggle fast mode",
    });
  });
}
