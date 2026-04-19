import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerProvidersSettings } from "./settings";
import { setupUsageCommand } from "./usage";

export function setupCommands(pi: ExtensionAPI): void {
  setupUsageCommand(pi);
  registerProvidersSettings(pi);
}
