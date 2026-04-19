import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupCommands } from "./commands";
import { configLoader } from "./config";
import { setupHooks } from "./hooks";

export default async function providersExtension(
  pi: ExtensionAPI,
): Promise<void> {
  await configLoader.load();

  setupCommands(pi);
  setupHooks(pi);
}
