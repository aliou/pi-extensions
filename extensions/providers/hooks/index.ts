import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupCodexFastModeHooks } from "./codex/fast-mode";
import { setupWarningHooks } from "./warnings";

export function setupHooks(pi: ExtensionAPI): void {
  setupWarningHooks(pi);
  setupCodexFastModeHooks(pi);
}
