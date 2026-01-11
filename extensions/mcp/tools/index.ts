import { StringEnum } from "@mariozechner/pi-ai";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import type { MCPManager } from "../manager";

// Format content from MCP result to string
function formatContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "object" && c !== null && "type" in c) {
          const typed = c as { type: string; text?: string };
          if (typed.type === "text" && typeof typed.text === "string") {
            return typed.text;
          }
        }
        return JSON.stringify(c);
      })
      .join("\n");
  }
  return JSON.stringify(content);
}

interface MCPToolDetails {
  action: string;
  serverName?: string;
  toolName?: string;
  success: boolean;
  result?: unknown;
  error?: string;
  servers?: Array<{ name: string; status: string; tools: string[] }>;
}

// Build dynamic description based on connected servers
function buildDescription(manager: MCPManager): string {
  const servers = manager.getServers();
  if (servers.length === 0) {
    return `MCP tool gateway. No servers configured. Add servers to ~/.pi/agent/mcp.json or .mcp.json`;
  }

  const lines = [
    "MCP tool gateway. Actions:",
    "- list: Show available servers and tools",
    "- call: Call a tool (requires server, tool, arguments)",
    "",
    "Available servers and tools:",
  ];

  for (const server of servers) {
    if (server.status.status === "connected") {
      lines.push(`  ${server.name}:`);
      for (const tool of server.status.tools) {
        const desc = tool.description ? ` - ${tool.description}` : "";
        lines.push(`    - ${tool.name}${desc}`);
      }
    } else if (server.status.status === "failed") {
      lines.push(`  ${server.name}: (failed: ${server.status.error})`);
    } else if (server.status.status === "connecting") {
      lines.push(`  ${server.name}: (connecting...)`);
    } else {
      lines.push(`  ${server.name}: (disabled)`);
    }
  }

  return lines.join("\n");
}

const MCPParams = Type.Object({
  action: StringEnum(["list", "call"] as const, {
    description: "Action: list (show servers/tools), call (invoke a tool)",
  }),
  server: Type.Optional(
    Type.String({ description: "Server name (required for call)" }),
  ),
  tool: Type.Optional(
    Type.String({ description: "Tool name (required for call)" }),
  ),
  arguments: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description: "Arguments to pass to the tool (for call)",
    }),
  ),
});

export function setupMCPTools(pi: ExtensionAPI, manager: MCPManager) {
  pi.registerTool<typeof MCPParams, MCPToolDetails>({
    name: "mcp",
    label: "MCP",
    // Description will be updated dynamically, but we need an initial one
    description: buildDescription(manager),
    parameters: MCPParams,

    async execute(
      _toolCallId: string,
      params: {
        action: "list" | "call";
        server?: string;
        tool?: string;
        arguments?: Record<string, unknown>;
      },
      _onUpdate: unknown,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ): Promise<AgentToolResult<MCPToolDetails>> {
      if (params.action === "list") {
        const servers = manager.getServers();
        const serverInfo = servers.map((s) => ({
          name: s.name,
          status: s.status.status,
          tools:
            s.status.status === "connected"
              ? s.status.tools.map((t) => t.name)
              : [],
        }));

        const lines = ["MCP Servers:"];
        for (const s of serverInfo) {
          if (s.status === "connected") {
            lines.push(`  ${s.name}: connected (${s.tools.length} tools)`);
            for (const tool of s.tools) {
              lines.push(`    - ${tool}`);
            }
          } else {
            lines.push(`  ${s.name}: ${s.status}`);
          }
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: {
            action: "list",
            success: true,
            servers: serverInfo,
          },
        };
      }

      // action === "call"
      if (!params.server) {
        return {
          content: [
            { type: "text", text: "Missing required parameter: server" },
          ],
          details: { action: "call", success: false, error: "Missing server" },
        };
      }
      if (!params.tool) {
        return {
          content: [{ type: "text", text: "Missing required parameter: tool" }],
          details: { action: "call", success: false, error: "Missing tool" },
        };
      }

      const args = params.arguments ?? {};
      const result = await manager.callTool(params.server, params.tool, args);

      if (result.isError) {
        const errorText = formatContent(result.content);
        return {
          content: [{ type: "text", text: errorText }],
          details: {
            action: "call",
            serverName: params.server,
            toolName: params.tool,
            success: false,
            error: errorText,
          },
        };
      }

      const resultText = formatContent(result.content);
      return {
        content: [{ type: "text", text: resultText }],
        details: {
          action: "call",
          serverName: params.server,
          toolName: params.tool,
          success: true,
          result: result.content,
        },
      };
    },

    renderCall(
      args: {
        action: "list" | "call";
        server?: string;
        tool?: string;
        arguments?: Record<string, unknown>;
      },
      theme: Theme,
    ): Text {
      let text = theme.fg("toolTitle", theme.bold("mcp "));
      text += theme.fg("accent", args.action);
      if (args.action === "call" && args.server && args.tool) {
        text += ` ${theme.fg("muted", `${args.server}/${args.tool}`)}`;
      }
      return new Text(text, 0, 0);
    },

    renderResult(
      result: AgentToolResult<MCPToolDetails>,
      _options: ToolRenderResultOptions,
      theme: Theme,
    ): Text {
      const { details } = result;
      if (!details) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" && text.text ? text.text : "No result",
          0,
          0,
        );
      }

      if (!details.success) {
        return new Text(
          theme.fg("error", `Error: ${details.error || "Unknown error"}`),
          0,
          0,
        );
      }

      if (details.action === "list" && details.servers) {
        const lines: string[] = [];
        for (const s of details.servers) {
          const status =
            s.status === "connected"
              ? theme.fg("success", `connected (${s.tools.length} tools)`)
              : theme.fg("warning", s.status);
          lines.push(`${theme.fg("accent", s.name)}: ${status}`);
        }
        return new Text(lines.join("\n"), 0, 0);
      }

      // Call result
      const resultText = result.content[0];
      const text =
        resultText?.type === "text" && resultText.text
          ? resultText.text.slice(0, 500)
          : "Success";
      return new Text(text, 0, 0);
    },
  });

  // Return a function to update the tool description after connecting
  return {
    updateDescription: () => {
      // The tool is already registered, but we can update the system prompt
      // by re-registering with the same name (it will override)
      // This is a workaround - ideally Pi would have a way to update tool descriptions
    },
  };
}
