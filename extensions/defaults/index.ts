import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupHooks } from "./hooks";
import { setupCommands } from "./setup-commands";

export default async function (pi: ExtensionAPI) {
  setupHooks(pi);
  setupCommands(pi);
}
