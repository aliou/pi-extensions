import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupFooterHook } from "./footer";
import { setupHeaderHook } from "./header";
import { setupNotificationHook } from "./notification";

export function setupHooks(pi: ExtensionAPI) {
  setupNotificationHook(pi);
  setupFooterHook(pi);
  setupHeaderHook(pi);
}
