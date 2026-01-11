import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupMCPCommands } from "./commands";
import { setupMCPHooks } from "./hooks";
import { MCPManager } from "./manager";
import { setupMCPTools } from "./tools";

export default function (pi: ExtensionAPI) {
  const manager = new MCPManager();

  // Register the mcp tool (at load time, synchronously)
  setupMCPTools(pi, manager);

  // Register /mcp command
  setupMCPCommands(pi, manager);

  // Connect to servers on session_start, cleanup on shutdown
  setupMCPHooks(pi, manager);
}
