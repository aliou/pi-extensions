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

export interface HeaderData {
  logo: string;
  commands: Array<{ name: string; description: string }>;
  shortcuts: Array<{ key: string; description: string }>;
  completions: Array<{ trigger: string; description: string }>;
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

  private rebuild() {
    const { logo, commands, shortcuts, completions } = this.data;

    this.clear();
    this.addChild(new Spacer(1));
    this.addChild(new Text(this.theme.fg("accent", logo), 1, 0));
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
  return {
    setup: (ctx: ExtensionContext, data: HeaderData) => {
      if (!ctx.hasUI) return;

      ctx.ui.setHeader((_tui: unknown, theme: Theme) =>
        createHeaderComponent(theme, data),
      );
    },
    cleanup: (ctx?: ExtensionContext) => {
      ctx?.ui.setHeader(undefined);
    },
  };
}
