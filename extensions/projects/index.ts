import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerProjectInitCommand } from "./commands/init";
import { configLoader } from "./config";

export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  registerProjectInitCommand(pi);
}
