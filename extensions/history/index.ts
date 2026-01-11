import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupCommands } from "./commands";
import { setupHooks } from "./hooks";
import { setupTools } from "./tools";

export default function (pi: ExtensionAPI) {
  setupTools(pi);
  setupCommands(pi);
  setupHooks(pi);
}
