import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupCodexFastModeHooks } from "./codex/fast-mode";
import { setupWarningHooks } from "./warnings";

export function setupHooks(pi: ExtensionAPI): void {
  setupWarningHooks(pi);
  setupCodexFastModeHooks(pi);
}
