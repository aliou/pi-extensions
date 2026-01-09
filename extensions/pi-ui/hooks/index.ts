import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupChromeHook } from "./chrome";

export function setupPiUiHooks(pi: ExtensionAPI) {
  setupChromeHook(pi);
}
