import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupMetaTools } from "./tools";

export default function (pi: ExtensionAPI) {
  setupMetaTools(pi);
}
