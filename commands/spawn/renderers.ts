import type {
  MessageRenderOptions,
  Theme,
} from "@mariozechner/pi-coding-agent";
import {
  getMarkdownTheme,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import { Box, Markdown, Text } from "@mariozechner/pi-tui";
import { messageContentToText } from "./helpers";
import type {
  SessionLinkMarkerDetails,
  SessionLinkMessage,
  SessionLinkSourceDetails,
  SessionLinkType,
} from "./types";

function resolveSessionName(sessionFile: string): string {
  try {
    const sm = SessionManager.open(sessionFile);
    return sm.getSessionName() ?? sm.getSessionId().slice(0, 8);
  } catch {
    return sessionFile;
  }
}

export function renderMarker(
  message: SessionLinkMessage,
  _options: MessageRenderOptions,
  theme: Theme,
) {
  const details = message.details as SessionLinkMarkerDetails | undefined;
  if (!details?.targetSessionFile) return undefined;

  const displayName = resolveSessionName(details.targetSessionFile);
  const linkType: SessionLinkType = details.linkType ?? "handoff";
  const labelText =
    linkType === "continue" ? "Continues in " : "Handed off to ";
  const displayText = `${theme.fg("muted", labelText)}${theme.fg("accent", displayName)}`;

  const box = new Box(1, 1, (t) => theme.bg("customMessageBg", t));
  box.addChild(new Text(displayText, 0, 0));
  return box;
}

export function renderSource(
  message: SessionLinkMessage,
  options: MessageRenderOptions,
  theme: Theme,
) {
  const details = message.details as SessionLinkSourceDetails | undefined;
  if (!details?.parentSessionFile) return undefined;

  const { expanded } = options;
  const displayName = resolveSessionName(details.parentSessionFile);
  const linkType: SessionLinkType = details.linkType ?? "handoff";
  const labelText =
    linkType === "continue" ? "Continued from " : "Continuing from ";
  const header = `${theme.fg("muted", labelText)}${theme.fg("accent", displayName)}`;

  const content = messageContentToText(message.content);

  const box = new Box(1, 1, (t) => theme.bg("customMessageBg", t));
  box.addChild(new Text(header, 0, 0));

  if (content) {
    if (expanded) {
      box.addChild(new Text("", 0, 0));

      try {
        const md = new Markdown(content, 0, 0, getMarkdownTheme());
        box.addChild(md);
      } catch {
        box.addChild(new Text(theme.fg("muted", content), 0, 0));
      }
    } else {
      box.addChild(new Text(theme.fg("dim", "Press Ctrl+O to expand"), 0, 0));
    }
  }

  return box;
}
