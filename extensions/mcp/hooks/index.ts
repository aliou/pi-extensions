import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { loadMCPConfig } from "../config";
import type { MCPManager } from "../manager";

export function setupMCPHooks(pi: ExtensionAPI, manager: MCPManager): void {
  // Connect to MCP servers on session start
  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    // Load config
    const configs = loadMCPConfig(ctx.cwd);
    const serverNames = Object.keys(configs);

    if (serverNames.length === 0) return;

    // Add servers to manager
    for (const [name, config] of Object.entries(configs)) {
      manager.addServer(name, config);
    }

    // Connect to all servers in parallel
    const results = await manager.connectAll();

    // Collect results for notification
    const connected: string[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const [name, status] of results) {
      if (status.status === "connected") {
        connected.push(`${name} (${status.tools.length} tools)`);
      } else if (status.status === "failed") {
        failed.push({ name, error: status.error });
      }
    }

    // Show notifications if UI available
    if (ctx.hasUI) {
      // Show failures prominently
      for (const { name, error } of failed) {
        ctx.ui.notify(`MCP: ${name} failed - ${error}`, "error");
      }

      // Show success summary
      if (connected.length > 0) {
        const totalTools = manager
          .getServers()
          .filter((s) => s.status.status === "connected")
          .reduce(
            (sum, s) =>
              sum +
              (s.status.status === "connected" ? s.status.tools.length : 0),
            0,
          );
        ctx.ui.notify(
          `MCP: ${connected.length} server(s), ${totalTools} tools`,
          "info",
        );
      }
    }
  });

  // Cleanup on session shutdown
  pi.on("session_shutdown", async () => {
    await manager.cleanup();
  });
}
