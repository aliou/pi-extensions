import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupCodexFastModeHooks } from "./codex/fast-mode";
import { setupCodexVerbosityHooks } from "./codex/verbosity";
import { setupContextWindowOverrides } from "./context-window-overrides";
import { setupWarningHooks } from "./warnings";

export function setupHooks(pi: ExtensionAPI): void {
  setupContextWindowOverrides(pi);
  setupWarningHooks(pi);
  setupCodexFastModeHooks(pi);
  setupCodexVerbosityHooks(pi);
}
