/**
 * Custom header showing harness shortcuts and commands.
 *
 * Instead of the built-in keybinding hints, displays only
 * the custom shortcuts and commands defined in harness extensions.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { rawKeyHint } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";

// Custom commands defined in harness extensions.
const COMMANDS: { name: string; description: string }[] = [
  { name: "qq[:list]", description: "quick question/side chat context" },
  { name: "spawn", description: "new linked session" },
  { name: "continue", description: "resume recent session" },
  { name: "label", description: "bookmark current point" },
  { name: "providers:usage", description: "usage dashboard" },
];

// Custom shortcuts defined in harness extensions.
const SHORTCUTS: { key: string; description: string }[] = [
  { key: "ctrl+shift+s", description: "stash/unstash editor" },
];

function createHeaderComponent(theme: Theme): Container {
  const container = new Container();

  container.addChild(new Text(theme.fg("accent", "pi"), 0, 0));

  container.addChild(new Spacer(1));

  container.addChild(new Text(theme.fg("muted", "Commands"), 0, 0));
  for (const command of COMMANDS) {
    container.addChild(
      new Text(rawKeyHint(`/${command.name}`, command.description), 0, 0),
    );
  }

  container.addChild(new Spacer(1));

  container.addChild(new Text(theme.fg("muted", "Shortcuts"), 0, 0));
  for (const shortcut of SHORTCUTS) {
    container.addChild(
      new Text(rawKeyHint(shortcut.key, shortcut.description), 0, 0),
    );
  }

  return container;
}

export function createCustomHeader(_pi: ExtensionAPI) {
  return {
    setup: (ctx: ExtensionContext) => {
      if (!ctx.hasUI) return;

      ctx.ui.setHeader((_tui: unknown, theme: Theme) =>
        createHeaderComponent(theme),
      );
    },
    cleanup: (ctx?: ExtensionContext) => {
      ctx?.ui.setHeader(undefined);
    },
  };
}
