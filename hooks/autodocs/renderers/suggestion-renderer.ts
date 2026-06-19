/**
 * Renders the injected "autodocs-suggestion" custom message as an accent
 * card in the chat. The same content is also seen by the main agent (via the
 * nextTurn delivery), so this is purely the visual surface.
 */

import type { MessageRenderer, Theme } from "@earendil-works/pi-coding-agent";
import { wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { wrapInRoundedBorder } from "@harness/ui/border";
import {
  AUTODOCS_SUGGESTION_TYPE,
  type AutodocsSuggestionDetails,
} from "../lib/types";

export const renderSuggestion: MessageRenderer<AutodocsSuggestionDetails> = (
  message,
  _options,
  theme: Theme,
) => {
  const details = message.details;
  const brief =
    (typeof message.content === "string" ? message.content : "").trim() ||
    details?.brief?.trim() ||
    "Docs may need updating.";

  return {
    render(width: number) {
      const inner = Math.max(1, width - 4);

      const lines: string[] = [];
      lines.push(theme.fg("customMessageLabel", "autodocs suggestion"));
      if (details?.fromSha && details?.toSha) {
        lines.push(theme.fg("muted", `${details.fromSha} → ${details.toSha}`));
      }
      lines.push("");
      lines.push(...wrapTextWithAnsi(theme.fg("text", brief), inner));

      const padded = lines.map((line) => ` ${line} `);
      return wrapInRoundedBorder(padded, {
        width,
        color: (s) => theme.fg("accent", s),
        title: "autodocs",
      });
    },
    handleInput() {},
    invalidate() {},
  };
};

export { AUTODOCS_SUGGESTION_TYPE };
