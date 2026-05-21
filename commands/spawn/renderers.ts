import type {
  MessageRenderOptions,
  Theme,
} from "@earendil-works/pi-coding-agent";
import {
  getMarkdownTheme,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { Box, Markdown, Text } from "@earendil-works/pi-tui";
import { messageContentToText } from "./helpers";
import type {
  SessionLinkMarkerDetails,
  SessionLinkMessage,
  SessionLinkSourceDetails,
} from "./types";

function resolveSessionName(sessionFile: string): string {
  try {
    const sm = SessionManager.open(sessionFile);
    return sm.getSessionName() ?? sm.getSessionId().slice(0, 8);
  } catch (_error) {
    void _error;
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
  const labelSuffix =
    details.contextStrategy === "last-assistant" ? " with last message" : "";
  const displayText = `${theme.fg("muted", "Continues in ")}${theme.fg("accent", displayName)}${theme.fg("muted", labelSuffix)}`;

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
  const labelSuffix =
    details.contextStrategy === "last-assistant" ? " with last message" : "";
  const header = `${theme.fg("muted", "Continues from ")}${theme.fg("accent", displayName)}${theme.fg("muted", labelSuffix)}`;

  const content = messageContentToText(message.content);

  const box = new Box(1, 1, (t) => theme.bg("customMessageBg", t));
  box.addChild(new Text(header, 0, 0));

  if (content) {
    if (expanded) {
      box.addChild(new Text("", 0, 0));

      try {
        const md = new Markdown(content, 0, 0, getMarkdownTheme());
        box.addChild(md);
      } catch (_error) {
        void _error;
        box.addChild(new Text(theme.fg("muted", content), 0, 0));
      }
    } else {
      box.addChild(new Text(theme.fg("dim", "Press Ctrl+O to expand"), 0, 0));
    }
  }

  return box;
}
