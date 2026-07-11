import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAnthropicProvider } from "./anthropic";
import { getOpenAICodexProvider } from "./openai-codex";

export default function (pi: ExtensionAPI): void {
  const anthropicProvider = getAnthropicProvider();
  if (anthropicProvider) {
    pi.registerProvider("anthropic", anthropicProvider);
  }

  const openAICodexProvider = getOpenAICodexProvider();
  if (openAICodexProvider) {
    pi.registerProvider("openai-codex", openAICodexProvider);
  }
}
