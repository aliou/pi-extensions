import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAnthropicProvider } from "./anthropic";
import {
  type CodexResponsesPayload,
  injectDetailedReasoningSummary,
} from "./openai-codex";

export default function (pi: ExtensionAPI): void {
  const anthropicProvider = getAnthropicProvider();
  if (anthropicProvider) {
    pi.registerProvider("anthropic", anthropicProvider);
  }

  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== "openai-codex") return;

    return injectDetailedReasoningSummary(
      event.payload as CodexResponsesPayload,
    );
  });
}
