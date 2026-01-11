import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { type Component, matchesKey, visibleWidth } from "@mariozechner/pi-tui";
import type { MCPManager } from "../manager";
import type { ServerInfo } from "../types";

type View = "list" | "detail";

class MCPComponent implements Component {
  private tui: { requestRender: () => void };
  private theme: Theme;
  private onClose: () => void;
  private manager: MCPManager;

  private view: View = "list";
  private selectedIndex = 0;
  private cachedLines: string[] = [];
  private cachedWidth = 0;

  constructor(
    tui: { requestRender: () => void },
    theme: Theme,
    onClose: () => void,
    manager: MCPManager,
  ) {
    this.tui = tui;
    this.theme = theme;
    this.onClose = onClose;
    this.manager = manager;
  }

  handleInput(data: string): boolean {
    const servers = this.manager.getServers();

    if (this.view === "list") {
      if (matchesKey(data, "down") || data === "j") {
        if (servers.length > 0) {
          this.selectedIndex = Math.min(
            this.selectedIndex + 1,
            servers.length - 1,
          );
          this.invalidate();
          this.tui.requestRender();
        }
        return true;
      }

      if (matchesKey(data, "up") || data === "k") {
        if (servers.length > 0) {
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          this.invalidate();
          this.tui.requestRender();
        }
        return true;
      }

      if (matchesKey(data, "return") || data === "l") {
        if (servers.length > 0) {
          this.view = "detail";
          this.invalidate();
          this.tui.requestRender();
        }
        return true;
      }

      if (data === "e") {
        if (servers.length > 0 && this.selectedIndex < servers.length) {
          const server = servers[this.selectedIndex];
          const isEnabled = server.status.status !== "disabled";
          void this.manager.setEnabled(server.name, !isEnabled).then(() => {
            this.invalidate();
            this.tui.requestRender();
          });
        }
        return true;
      }

      if (data === "r") {
        if (servers.length > 0 && this.selectedIndex < servers.length) {
          const server = servers[this.selectedIndex];
          void this.manager.connect(server.name).then(() => {
            this.invalidate();
            this.tui.requestRender();
          });
        }
        return true;
      }

      if (matchesKey(data, "escape") || data === "q" || data === "Q") {
        this.onClose();
        return true;
      }
    } else {
      if (matchesKey(data, "escape") || data === "b" || data === "h") {
        this.view = "list";
        this.invalidate();
        this.tui.requestRender();
        return true;
      }

      if (data === "r") {
        if (servers.length > 0 && this.selectedIndex < servers.length) {
          const server = servers[this.selectedIndex];
          void this.manager.connect(server.name).then(() => {
            this.invalidate();
            this.tui.requestRender();
          });
        }
        return true;
      }

      if (data === "q" || data === "Q") {
        this.onClose();
        return true;
      }
    }

    return true;
  }

  invalidate(): void {
    this.cachedWidth = 0;
    this.cachedLines = [];
  }

  render(width: number): string[] {
    if (width === this.cachedWidth && this.cachedLines.length > 0) {
      return this.cachedLines;
    }

    const innerWidth = width - 4;
    const t = this.theme;

    const boxLine = (content: string) => {
      const contentLen = visibleWidth(content);
      const padding = Math.max(0, innerWidth - contentLen);
      return `${t.fg("dim", " \u2502")} ${content}${" ".repeat(padding)}${t.fg("dim", "\u2502")}`;
    };

    const padLine = (line: string) => {
      const visLen = visibleWidth(line);
      const padding = Math.max(0, width - visLen);
      return line + " ".repeat(padding);
    };

    if (this.view === "list") {
      this.cachedLines = this.renderList(width, innerWidth, boxLine, padLine);
    } else {
      this.cachedLines = this.renderDetail(width, innerWidth, boxLine, padLine);
    }

    this.cachedWidth = width;
    return this.cachedLines;
  }

  private renderList(
    width: number,
    _innerWidth: number,
    boxLine: (s: string) => string,
    padLine: (s: string) => string,
  ): string[] {
    const lines: string[] = [];
    const servers = this.manager.getServers();
    const t = this.theme;

    const title = ` ${t.bold(t.fg("accent", "MCP Servers"))} `;
    const titleLen = visibleWidth(title);
    const dashesTotal = width - 3 - titleLen;
    const leftDashes = Math.floor(dashesTotal / 2);
    const rightDashes = dashesTotal - leftDashes;
    lines.push(
      padLine(
        t.fg("dim", ` \u256D${"\u2500".repeat(leftDashes)}`) +
          title +
          t.fg("dim", `${"\u2500".repeat(rightDashes)}\u256E`),
      ),
    );

    if (servers.length === 0) {
      lines.push(padLine(boxLine("")));
      lines.push(padLine(boxLine(t.fg("dim", "No MCP servers configured"))));
      lines.push(
        padLine(
          boxLine(
            t.fg("dim", "Add servers to ~/.pi/agent/mcp.json or .mcp.json"),
          ),
        ),
      );
      lines.push(padLine(boxLine("")));
    } else {
      lines.push(padLine(boxLine("")));

      if (this.selectedIndex >= servers.length) {
        this.selectedIndex = Math.max(0, servers.length - 1);
      }

      for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        const isSelected = i === this.selectedIndex;
        const statusIcon = this.getStatusIcon(server);
        const statusText = this.getStatusText(server);

        const prefix = isSelected ? t.fg("accent", "> ") : "  ";
        const name = isSelected ? t.fg("accent", server.name) : server.name;
        const namePadded = this.padVisible(name, 20);
        const line = `${prefix}${statusIcon} ${namePadded} ${statusText}`;
        lines.push(padLine(boxLine(line)));
      }

      lines.push(padLine(boxLine("")));
    }

    lines.push(
      padLine(t.fg("dim", ` \u251C${"\u2500".repeat(width - 3)}\u2524`)),
    );
    const footer = `${t.fg("dim", "j/k")} select  ${t.fg("dim", "Enter")} details  ${t.fg("dim", "e")} toggle  ${t.fg("dim", "r")} reconnect  ${t.fg("dim", "q")} quit`;
    lines.push(padLine(boxLine(footer)));
    lines.push(
      padLine(t.fg("dim", ` \u2570${"\u2500".repeat(width - 3)}\u256F`)),
    );

    return lines;
  }

  private renderDetail(
    width: number,
    _innerWidth: number,
    boxLine: (s: string) => string,
    padLine: (s: string) => string,
  ): string[] {
    const lines: string[] = [];
    const servers = this.manager.getServers();
    const server = servers[this.selectedIndex];
    const t = this.theme;

    if (!server) {
      this.view = "list";
      return this.renderList(width, _innerWidth, boxLine, padLine);
    }

    const title = ` ${t.bold(t.fg("accent", server.name))} `;
    const titleLen = visibleWidth(title);
    const dashesTotal = width - 3 - titleLen;
    const leftDashes = Math.floor(dashesTotal / 2);
    const rightDashes = dashesTotal - leftDashes;
    lines.push(
      padLine(
        t.fg("dim", ` \u256D${"\u2500".repeat(leftDashes)}`) +
          title +
          t.fg("dim", `${"\u2500".repeat(rightDashes)}\u256E`),
      ),
    );

    lines.push(padLine(boxLine("")));
    lines.push(
      padLine(
        boxLine(
          `Status: ${this.getStatusIcon(server)} ${this.getStatusText(server)}`,
        ),
      ),
    );
    lines.push(padLine(boxLine(`Transport: ${server.transportType}`)));

    if (server.transportType === "stdio") {
      const cmd = server.config.command || "(none)";
      const args = server.config.args ? ` ${server.config.args.join(" ")}` : "";
      lines.push(padLine(boxLine(`Command: ${cmd}${args}`)));
      if (server.config.cwd) {
        lines.push(padLine(boxLine(`Working Dir: ${server.config.cwd}`)));
      }
    } else {
      lines.push(padLine(boxLine(`URL: ${server.config.url || "(none)"}`)));
    }

    lines.push(padLine(boxLine("")));
    lines.push(
      padLine(t.fg("dim", ` \u251C${"\u2500".repeat(width - 3)}\u2524`)),
    );

    if (server.status.status === "connected") {
      lines.push(padLine(boxLine(t.bold("Tools:"))));
      lines.push(padLine(boxLine("")));

      if (server.status.tools.length === 0) {
        lines.push(padLine(boxLine(t.fg("dim", "  (no tools)"))));
      } else {
        for (const tool of server.status.tools) {
          const toolName = `  \u2022 ${tool.name}`;
          if (tool.description) {
            lines.push(
              padLine(
                boxLine(`${toolName} ${t.fg("dim", `- ${tool.description}`)}`),
              ),
            );
          } else {
            lines.push(padLine(boxLine(toolName)));
          }
        }
      }
    } else if (server.status.status === "failed") {
      lines.push(
        padLine(boxLine(t.fg("error", `Error: ${server.status.error}`))),
      );
    } else if (server.status.status === "connecting") {
      lines.push(padLine(boxLine(t.fg("warning", "Connecting..."))));
    } else if (server.status.status === "disabled") {
      lines.push(padLine(boxLine(t.fg("dim", "Server is disabled"))));
    }

    lines.push(padLine(boxLine("")));

    lines.push(
      padLine(t.fg("dim", ` \u251C${"\u2500".repeat(width - 3)}\u2524`)),
    );
    const footer = `${t.fg("dim", "b/Esc")} back  ${t.fg("dim", "r")} reconnect  ${t.fg("dim", "q")} quit`;
    lines.push(padLine(boxLine(footer)));
    lines.push(
      padLine(t.fg("dim", ` \u2570${"\u2500".repeat(width - 3)}\u256F`)),
    );

    return lines;
  }

  private getStatusIcon(server: ServerInfo): string {
    const t = this.theme;
    switch (server.status.status) {
      case "connecting":
        return t.fg("warning", "\u25CB");
      case "connected":
        return t.fg("success", "\u25CF");
      case "failed":
        return t.fg("error", "\u2717");
      case "disabled":
        return t.fg("dim", "\u25CB");
    }
  }

  private getStatusText(server: ServerInfo): string {
    const t = this.theme;
    switch (server.status.status) {
      case "connecting":
        return t.fg("warning", "connecting...");
      case "connected":
        return t.fg(
          "success",
          `connected (${server.status.tools.length} tools)`,
        );
      case "failed":
        return t.fg("error", `failed: ${server.status.error}`);
      case "disabled":
        return t.fg("dim", "disabled");
    }
  }

  private padVisible(str: string, targetWidth: number): string {
    const currentWidth = visibleWidth(str);
    if (currentWidth >= targetWidth) return str;
    return str + " ".repeat(targetWidth - currentWidth);
  }
}

export function setupMCPCommands(pi: ExtensionAPI, manager: MCPManager): void {
  pi.registerCommand("mcp", {
    description: "View and manage MCP servers",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/mcp requires interactive mode", "error");
        return;
      }
      await ctx.ui.custom((tui, theme, _keybindings, done) => {
        return new MCPComponent(tui, theme, () => done(undefined), manager);
      });
    },
  });
}
