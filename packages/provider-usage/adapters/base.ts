import type { AuthStorage } from "@earendil-works/pi-coding-agent";
import type { ProviderSnapshot } from "../types";

export interface ProviderAdapter {
  provider: "anthropic" | "openai-codex" | "synthetic";
  fetch(
    authStorage: AuthStorage,
    signal?: AbortSignal,
  ): Promise<ProviderSnapshot>;
}
