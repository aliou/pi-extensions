import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MCPConfig, MCPServerConfig } from "./types";

// Config file paths in load order (later overrides earlier)
function getConfigPaths(cwd: string): string[] {
  return [
    join(homedir(), ".pi", "agent", "mcp.json"), // Global
    join(cwd, ".pi", "mcp.json"), // Project .pi/
    join(cwd, ".mcp.json"), // Project root
  ];
}

function loadConfigFile(path: string): MCPConfig | null {
  if (!existsSync(path)) return null;
  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as MCPConfig;
  } catch (e) {
    console.warn(`Failed to parse MCP config at ${path}:`, e);
    return null;
  }
}

export function loadMCPConfig(cwd: string): Record<string, MCPServerConfig> {
  const paths = getConfigPaths(cwd);
  const merged: Record<string, MCPServerConfig> = {};

  for (const path of paths) {
    const config = loadConfigFile(path);
    if (config?.mcpServers) {
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        // Later configs override earlier ones, but merge properties
        merged[name] = { ...merged[name], ...serverConfig };
      }
    }
  }

  return merged;
}

export function getTransportType(config: MCPServerConfig): "stdio" | "http" {
  return config.url ? "http" : "stdio";
}
