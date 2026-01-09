import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupPiUiHooks } from "./hooks";

export default function (pi: ExtensionAPI) {
  setupPiUiHooks(pi);
}
