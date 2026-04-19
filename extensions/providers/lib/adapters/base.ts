import type { AuthStorage } from "@mariozechner/pi-coding-agent";
import type { ProviderSnapshot } from "../types";

export interface ProviderAdapter {
  provider: "anthropic" | "openai-codex" | "synthetic" | "opencode-go";
  fetch(
    authStorage: AuthStorage,
    signal?: AbortSignal,
  ): Promise<ProviderSnapshot>;
}
