import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupHooks } from "./hooks";

export default async function (pi: ExtensionAPI) {
  setupHooks(pi);
}
