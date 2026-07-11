import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAnthropicProvider } from "./anthropic";

export default function (pi: ExtensionAPI): void {
  const anthropicProvider = getAnthropicProvider();
  if (!anthropicProvider) return;

  pi.registerProvider("anthropic", anthropicProvider);
}
