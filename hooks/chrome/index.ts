import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupFooterHook } from "./hooks/footer";
import { setupHeaderHook } from "./hooks/header";
import { setupNotificationHook } from "./hooks/notification";

export default async function (pi: ExtensionAPI) {
  setupNotificationHook(pi);
  setupFooterHook(pi);
  setupHeaderHook(pi);
}
