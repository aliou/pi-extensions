import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { getTransportType } from "./config.js";
import type {
  MCPServerConfig,
  MCPToolInfo,
  ServerInfo,
  ServerStatus,
} from "./types.js";

interface ManagedServer {
  name: string;
  config: MCPServerConfig;
  client: Client | null;
  transport: Transport | null;
  status: ServerStatus;
}

export class MCPManager {
  private servers: Map<string, ManagedServer> = new Map();
  private defaultTimeout = 30000;

  // Initialize with server configs (doesn't connect yet)
  addServer(name: string, config: MCPServerConfig): void {
    const enabled = config.enabled !== false;
    this.servers.set(name, {
      name,
      config,
      client: null,
      transport: null,
      status: enabled ? { status: "connecting" } : { status: "disabled" },
    });
  }

  // Connect to a specific server
  async connect(name: string): Promise<ServerStatus> {
    const server = this.servers.get(name);
    if (!server) return { status: "failed", error: "Server not found" };
    if (server.config.enabled === false) return { status: "disabled" };

    server.status = { status: "connecting" };
    const timeout = server.config.timeout ?? this.defaultTimeout;

    try {
      const client = new Client(
        { name: "pi-mcp-client", version: "1.0.0" },
        { capabilities: {} },
      );

      let transport: Transport;
      const transportType = getTransportType(server.config);

      if (transportType === "http" && server.config.url) {
        transport = await this.createHttpTransport(server.config.url);
      } else if (server.config.command) {
        transport = new StdioClientTransport({
          command: server.config.command,
          args: server.config.args,
          env: { ...process.env, ...server.config.env } as Record<
            string,
            string
          >,
          cwd: server.config.cwd,
        });
      } else {
        throw new Error("Server config must have either 'url' or 'command'");
      }

      // Connect with timeout
      await Promise.race([
        client.connect(transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), timeout),
        ),
      ]);

      // List tools to verify connection
      const toolsResult = await Promise.race([
        client.listTools(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("List tools timeout")), timeout),
        ),
      ]);

      const tools: MCPToolInfo[] = toolsResult.tools.map(
        (t: { name: string; description?: string; inputSchema: unknown }) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }),
      );

      server.client = client;
      server.transport = transport;
      server.status = { status: "connected", tools };
      return server.status;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      server.status = { status: "failed", error };
      return server.status;
    }
  }

  // Try StreamableHTTP first, fall back to SSE
  private async createHttpTransport(url: string): Promise<Transport> {
    const urlObj = new URL(url);
    try {
      const transport = new StreamableHTTPClientTransport(urlObj);
      return transport;
    } catch {
      // Fall back to SSE
      return new SSEClientTransport(urlObj);
    }
  }

  // Connect to all enabled servers
  async connectAll(): Promise<Map<string, ServerStatus>> {
    const results = new Map<string, ServerStatus>();
    const promises = Array.from(this.servers.keys()).map(async (name) => {
      const status = await this.connect(name);
      results.set(name, status);
    });
    await Promise.allSettled(promises);
    return results;
  }

  // Get server info
  getServer(name: string): ServerInfo | null {
    const server = this.servers.get(name);
    if (!server) return null;
    return {
      name: server.name,
      config: server.config,
      status: server.status,
      transportType: getTransportType(server.config),
    };
  }

  // Get all servers
  getServers(): ServerInfo[] {
    return Array.from(this.servers.values()).map((s) => ({
      name: s.name,
      config: s.config,
      status: s.status,
      transportType: getTransportType(s.config),
    }));
  }

  // Get all tools from all connected servers
  getAllTools(): { serverName: string; tool: MCPToolInfo }[] {
    const tools: { serverName: string; tool: MCPToolInfo }[] = [];
    for (const server of this.servers.values()) {
      if (server.status.status === "connected") {
        for (const tool of server.status.tools) {
          tools.push({ serverName: server.name, tool });
        }
      }
    }
    return tools;
  }

  // Call a tool on a server
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }> {
    const server = this.servers.get(serverName);
    if (!server || !server.client) {
      return {
        content: [{ type: "text", text: `Server ${serverName} not connected` }],
        isError: true,
      };
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args,
      });
      return {
        content: result.content as Array<{ type: string; text?: string }>,
        isError: result.isError as boolean | undefined,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: error }], isError: true };
    }
  }

  // Enable/disable a server
  async setEnabled(name: string, enabled: boolean): Promise<void> {
    const server = this.servers.get(name);
    if (!server) return;

    if (enabled && server.status.status === "disabled") {
      await this.connect(name);
    } else if (!enabled && server.status.status !== "disabled") {
      await this.disconnect(name);
      server.status = { status: "disabled" };
    }
  }

  // Disconnect a server
  async disconnect(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (!server) return;

    try {
      if (server.transport) {
        await server.transport.close();
      }
    } catch {
      // Ignore close errors
    }
    server.client = null;
    server.transport = null;
  }

  // Disconnect all servers
  async disconnectAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.servers.keys()).map((name) => this.disconnect(name)),
    );
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.disconnectAll();
    this.servers.clear();
  }
}
