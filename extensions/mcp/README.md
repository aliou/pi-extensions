# MCP Extension

Integrates MCP (Model Context Protocol) servers with Pi, allowing the agent to use external tools and data sources.

## Features

- **Automatic Discovery**: Loads MCP server configs from multiple locations
- **Single Gateway Tool**: `mcp` tool with `list` and `call` actions
- **Command**: `/mcp` - Interactive panel to view and manage servers

## Configuration

Create an `mcp.json` file in one of these locations (later overrides earlier):

1. `~/.pi/agent/mcp.json` - Global config
2. `<project>/.pi/mcp.json` - Project config
3. `<project>/.mcp.json` - Project root config

### Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {},
      "enabled": true,
      "timeout": 30000
    },
    "remote-server": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Server Options

| Option | Type | Description |
|--------|------|-------------|
| `command` | string | Executable to run (stdio transport) |
| `args` | string[] | Command arguments |
| `env` | object | Environment variables |
| `cwd` | string | Working directory |
| `url` | string | Server URL (HTTP transport) |
| `enabled` | boolean | Enable/disable server (default: true) |
| `timeout` | number | Connection timeout in ms (default: 30000) |

## Usage

### Tool

The `mcp` tool has two actions:

**List servers and tools:**
```
mcp action="list"
```

**Call a tool:**
```
mcp action="call" server="github" tool="create_issue" arguments={"title": "Bug", "body": "..."}
```

The tool description dynamically includes all available servers and their tools, so the LLM knows what's available.

### Command

Run `/mcp` to open the server management panel:

```
MCP Servers
-----------------------------------
* github          connected (5 tools)
x filesystem      failed: ENOENT
o slack           disabled

[j/k] select  [Enter] details  [e] toggle  [r] reconnect  [q] quit
```

## Transport Types

- **Stdio**: Spawns a local process, communicates via stdin/stdout
- **HTTP**: Connects to remote server via Streamable HTTP (with SSE fallback)

## Error Handling

- Connection failures are logged and stored per server
- No automatic reconnection - use `/mcp` to manually reconnect
- Failed servers don't prevent other servers from connecting
