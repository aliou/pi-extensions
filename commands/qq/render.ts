import {
  getMarkdownTheme,
  keyHint,
  type MessageRenderer,
} from "@earendil-works/pi-coding-agent";
import { Markdown, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { wrapInRoundedBorder } from "@harness/ui/border";
import { formatFooter } from "./format";
import type { QqAnswerDetails } from "./types";

export function renderQqAnswerCard(
  details: QqAnswerDetails,
  options: { expanded: boolean; label?: string; includeHint?: boolean },
  theme: Parameters<MessageRenderer<QqAnswerDetails>>[2],
  width: number,
): string[] {
  const mdTheme = getMarkdownTheme();
  const contentWidth = Math.max(1, width - 4);
  const content: string[] = [];
  const label = options.label ?? "qq";

  content.push(
    theme.fg("customMessageLabel", `\x1b[1m${label}:\x1b[22m `) +
      details.question,
  );
  content.push("");

  const answer = options.expanded
    ? details.answer
    : details.answer.split(/\n\s*\n/).filter((p) => p.trim())[0] ||
      details.answer;

  try {
    const md = new Markdown(answer, 0, 0, mdTheme);
    content.push(...md.render(contentWidth));
  } catch {
    content.push(...new Text(answer, 0, 0).render(contentWidth));
  }

  const footer = formatFooter(details);
  const hint = options.includeHint
    ? keyHint(
        "app.tools.expand",
        options.expanded ? "to collapse" : "to expand",
      )
    : undefined;
  const footerLine = [hint, footer].filter(Boolean).join(" · ");
  if (footerLine) {
    content.push("");
    content.push(theme.fg("dim", truncateToWidth(footerLine, contentWidth)));
  }

  const padded = content.map((line) => ` ${line} `);
  return wrapInRoundedBorder(padded, {
    width,
    color: (text) => theme.fg("success", text),
  });
}
