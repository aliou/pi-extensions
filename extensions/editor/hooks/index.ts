import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupEditorHook } from "./editor";
import { setupEditorStashHook } from "./editor-stash";
import { setupShellIndicatorHook } from "./shell-indicator";

export function setupHooks(pi: ExtensionAPI) {
  setupEditorHook(pi);
  setupEditorStashHook(pi);
  setupShellIndicatorHook(pi);
}
