import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupDebugCommands } from "./commands";

export default function (pi: ExtensionAPI) {
  setupDebugCommands(pi);
}
