/**
 * Custom header showing harness shortcuts and commands.
 *
 * Instead of the built-in keybinding hints, displays only
 * the custom shortcuts and commands defined in harness extensions.
 *
 * Data is collected dynamically at session_start via the event bus so
 * extensions can register themselves regardless of load order.
 */

import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { rawKeyHint } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import type { WorkspaceMetadata } from "@harness/events";
import { collapseHomePath } from "@harness/utils/path";

export interface HeaderData {
  logo: string;
  logoRegistered?: boolean;
  workspaceMetadata?: WorkspaceMetadata;
  commands: Array<{ name: string; description: string }>;
  shortcuts: Array<{ key: string; description: string }>;
  completions: Array<{ trigger: string; description: string }>;
}

function cleanHeaderText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatWorkspaceMetadata(
  metadata: WorkspaceMetadata | undefined,
): string | null {
  if (!metadata) return null;

  const cwd = cleanHeaderText(collapseHomePath(metadata.cwd));
  if (!cwd) return null;

  const machineHost = cleanHeaderText(metadata.hostname);
  const prefix = machineHost ? `[${machineHost}] ` : "";

  const remote =
    metadata.remotes.find(
      (remote) => cleanHeaderText(remote.name) === "origin",
    ) ?? metadata.remotes[0];

  if (!remote) return `${prefix}${cwd}`;

  const remoteHost = cleanHeaderText(remote.host);
  const repo = cleanHeaderText(remote.repo);
  if (!remoteHost || !repo) return `${prefix}${cwd}`;

  const host = remoteHost === "github.com" ? "github" : remoteHost;
  return `${prefix}${host}:${repo}`;
}

class HeaderComponent extends Container {
  constructor(
    private readonly theme: Theme,
    private readonly data: HeaderData,
    private expanded = false,
  ) {
    super();
    this.rebuild();
  }

  setExpanded(expanded: boolean) {
    if (this.expanded === expanded) return;
    this.expanded = expanded;
    this.rebuild();
  }

  setWorkspaceMetadata(metadata: WorkspaceMetadata | undefined) {
    this.data.workspaceMetadata = metadata;
    this.rebuild();
  }

  private rebuild() {
    const {
      logo,
      logoRegistered,
      workspaceMetadata,
      commands,
      shortcuts,
      completions,
    } = this.data;
    const workspaceLine = formatWorkspaceMetadata(workspaceMetadata);

    this.clear();
    this.addChild(new Spacer(1));

    if (workspaceLine && !logoRegistered) {
      this.addChild(
        new Text(
          `${this.theme.fg("accent", logo)} ${this.theme.fg("success", workspaceLine)}`,
          1,
          0,
        ),
      );
    } else {
      this.addChild(new Text(this.theme.fg("accent", logo), 1, 0));
    }

    if (workspaceLine && logoRegistered) {
      this.addChild(new Text(this.theme.fg("success", workspaceLine), 1, 0));
    }

    this.addChild(new Spacer(1));

    if (!this.expanded) return;

    if (commands.length > 0) {
      this.addChild(new Text(this.theme.fg("muted", "Commands"), 1, 0));
      for (const command of commands) {
        this.addChild(
          new Text(rawKeyHint(`/${command.name}`, command.description), 1, 0),
        );
      }
      this.addChild(new Spacer(1));
    }

    if (shortcuts.length > 0) {
      this.addChild(new Text(this.theme.fg("muted", "Shortcuts"), 1, 0));
      for (const shortcut of shortcuts) {
        this.addChild(
          new Text(rawKeyHint(shortcut.key, shortcut.description), 1, 0),
        );
      }
      this.addChild(new Spacer(1));
    }

    if (completions.length > 0) {
      this.addChild(new Text(this.theme.fg("muted", "Completions"), 1, 0));
      for (const completion of completions) {
        this.addChild(
          new Text(
            rawKeyHint(completion.trigger, completion.description),
            1,
            0,
          ),
        );
      }
      this.addChild(new Spacer(1));
    }
  }
}

export function createHeaderComponent(
  theme: Theme,
  data: HeaderData,
): HeaderComponent {
  return new HeaderComponent(theme, data);
}

export function createCustomHeader() {
  let component: HeaderComponent | undefined;
  let currentData: HeaderData | undefined;

  return {
    setup: (ctx: ExtensionContext, data: HeaderData) => {
      if (!ctx.hasUI) return;

      currentData = data;
      ctx.ui.setHeader((_tui: unknown, theme: Theme) => {
        component = createHeaderComponent(theme, data);
        return component;
      });
    },
    setWorkspaceMetadata: (metadata: WorkspaceMetadata | undefined) => {
      if (currentData) currentData.workspaceMetadata = metadata;
      component?.setWorkspaceMetadata(metadata);
    },
    cleanup: (ctx?: ExtensionContext) => {
      component = undefined;
      currentData = undefined;
      ctx?.ui.setHeader(undefined);
    },
  };
}
