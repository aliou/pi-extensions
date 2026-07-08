import { getApiProvider } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAnthropicStreamSimple } from "./provider";

/** Adds `x-session-id` to Anthropic provider requests. */
export default function (pi: ExtensionAPI): void {
  const builtIn = getApiProvider("anthropic-messages");
  if (!builtIn?.streamSimple) return;

  pi.registerProvider("anthropic", {
    api: "anthropic-messages",
    streamSimple: createAnthropicStreamSimple(builtIn.streamSimple),
  });
}
