import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { addSessionAffinityHeader } from "./anthropic";
import {
  type CodexResponsesPayload,
  injectDetailedReasoningSummary,
} from "./openai-codex";

export default function (pi: ExtensionAPI): void {
  pi.on("before_provider_headers", (event, ctx) => {
    if (ctx.model?.provider !== "anthropic") return;

    addSessionAffinityHeader(event.headers, ctx.sessionManager.getSessionId());
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== "openai-codex") return;

    return injectDetailedReasoningSummary(
      event.payload as CodexResponsesPayload,
    );
  });
}
