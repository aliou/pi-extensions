import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupFooterHook } from "./footer";
import { setupHeaderHook } from "./header";
import { setupNotificationHook } from "./notification";
import { setupSessionNameHook } from "./session-name";

export function setupHooks(pi: ExtensionAPI) {
  setupSessionNameHook(pi);
  setupNotificationHook(pi);
  setupFooterHook(pi);
  setupHeaderHook(pi);
}
