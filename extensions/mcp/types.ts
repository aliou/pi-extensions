// MCP server configuration (matches Claude Desktop format)
export interface MCPServerConfig {
  // Stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  // HTTP transport
  url?: string;
  // Common
  enabled?: boolean; // default true
  timeout?: number; // connection timeout in ms, default 30000
}

export interface MCPConfig {
  mcpServers?: Record<string, MCPServerConfig>;
}

// Tool info from MCP server
export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: unknown; // JSON Schema
}

// Server status
export type ServerStatus =
  | { status: "connecting" }
  | { status: "connected"; tools: MCPToolInfo[] }
  | { status: "failed"; error: string }
  | { status: "disabled" };

// Server info for display
export interface ServerInfo {
  name: string;
  config: MCPServerConfig;
  status: ServerStatus;
  transportType: "stdio" | "http";
}
