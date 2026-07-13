import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { applyUsageObservationToCache } from "@harness/models/usage";
import { providerUsageRegistry } from "@harness/provider-usage";
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

  pi.on("after_provider_response", (event, ctx) => {
    if (
      ctx.model?.provider !== "openai-codex" ||
      event.status < 200 ||
      event.status >= 300
    ) {
      return;
    }
    try {
      const observations = providerUsageRegistry
        .get("openai-codex")
        ?.parseResponseHeaders?.(event.headers, { now: new Date() });
      for (const observation of observations ?? []) {
        void applyUsageObservationToCache(observation).catch(() => undefined);
      }
    } catch {
      // Quota telemetry must never interfere with a provider response.
      return;
    }
  });
}
