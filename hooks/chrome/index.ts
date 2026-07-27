import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupFooterHook } from "./hooks/footer";
import { setupHeaderHook } from "./hooks/header";

export default async function (pi: ExtensionAPI) {
  setupFooterHook(pi);
  setupHeaderHook(pi);
}
