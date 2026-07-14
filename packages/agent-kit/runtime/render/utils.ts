import type { Maybe } from "@harness/utils";
import { isNil } from "@harness/utils";
import type { SubagentModel } from "../../types";

export function extractParagraphs(content: string, count: number) {
  return content
    .trim()
    .split(/\n\s*\n/)
    .slice(0, count)
    .join("\n\n")
    .trim();
}

export function splitParagraphs(text: string) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim().length > 0);
}

/**
 * Maximum number of substantive paragraphs shown in a collapsed subagent
 * result preview. Leading scaffolding (headings, rules, short intro lines)
 * is shown for free and does not count against this budget.
 */
const COLLAPSED_SUBSTANCE_PARAGRAPHS = 3;

/**
 * Character budget for substantive paragraphs in a collapsed preview. Once
 * this is exceeded, no further paragraphs are added.
 */
const COLLAPSED_SUBSTANCE_CHARS = 1100;

/**
 * Hard cap on the full collapsed preview (substance + scaffolding). A single
 * oversized paragraph can still push past the substance budget; this cap
 * truncates the final string.
 */
const COLLAPSED_PREVIEW_CHARS = 1500;

/**
 * Paragraphs at or below this length are treated as scaffolding when they
 * contain no headings, code blocks, or tables (e.g. "Here is my analysis.").
 */
const SCAFFOLDING_MAX_CHARS = 120;

/**
 * A "scaffolding" paragraph is connective tissue (a standalone heading, a
 * horizontal rule, or a short intro sentence) that should be shown in a
 * collapsed preview without consuming the substantive-paragraph budget.
 */
export function isScaffoldingParagraph(paragraph: string): boolean {
  const text = paragraph.trim();
  if (!text) return true;
  // Standalone heading line ("# Title", "## Section", ...).
  if (/^#{1,6}\s/.test(text) && !text.includes("\n")) return true;
  // Horizontal rule.
  if (/^(---|\*\*\*|___)\s*$/.test(text)) return true;
  // Short intro line(s): no heading, code block, or table, and short enough
  // to be a one-liner like "Here is my complete analysis."
  if (
    text.length <= SCAFFOLDING_MAX_CHARS &&
    !/^#{1,6}/.test(text) &&
    !text.includes("```") &&
    !text.includes("|")
  ) {
    return true;
  }
  return false;
}

/**
 * Select a collapsed-preview slice of a subagent response.
 *
 * Leading scaffolding paragraphs (headings, rules, short intros) are shown
 * for free; up to `COLLAPSED_SUBSTANCE_PARAGRAPHS` substantive paragraphs (or
 * `COLLAPSED_SUBSTANCE_CHARS` characters of substance) are then appended.
 * Scaffolding interspersed between shown substance paragraphs is also free.
 * Once the substance budget is exhausted, nothing further is shown, so a
 * collapsed preview leads with the intro/heading and then contains the actual
 * answer rather than burning the whole budget on a single heading line.
 *
 * Returns the preview text and a count of remaining hidden paragraphs.
 */
export function selectCollapsedPreview(text: string): {
  preview: string;
  hidden: number;
} {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) {
    return { preview: text.trim(), hidden: 0 };
  }

  const shown: string[] = [];
  let substanceParagraphs = 0;
  let substanceChars = 0;

  for (const paragraph of paragraphs) {
    // Once enough substance has been shown, stop. This also prevents trailing
    // scaffolding (e.g. a final heading) from being appended after the budget
    // is spent.
    if (
      substanceParagraphs >= COLLAPSED_SUBSTANCE_PARAGRAPHS ||
      substanceChars >= COLLAPSED_SUBSTANCE_CHARS
    ) {
      break;
    }
    // Always let the first substantive paragraph through, even if it alone
    // exceeds the hard cap (it is hard-truncated below). After that, bound the
    // total preview length so a single trailing paragraph cannot overflow.
    const wouldBeFirstSubstance =
      substanceParagraphs === 0 && !isScaffoldingParagraph(paragraph);
    if (!wouldBeFirstSubstance && shown.length > 0) {
      const joined = shown.join("\n\n");
      if (joined.length + 2 + paragraph.length > COLLAPSED_PREVIEW_CHARS) {
        break;
      }
    }
    shown.push(paragraph);
    if (!isScaffoldingParagraph(paragraph)) {
      substanceParagraphs += 1;
      substanceChars += paragraph.length;
    }
  }

  let preview = shown.join("\n\n");
  if (preview.length > COLLAPSED_PREVIEW_CHARS) {
    preview = `${preview.slice(0, COLLAPSED_PREVIEW_CHARS).trimEnd()}…`;
  }
  const hidden = Math.max(0, paragraphs.length - shown.length);
  return { preview, hidden };
}

export function formatDuration(
  startedAt: Maybe<number>,
  endedAt: Maybe<number>,
) {
  if (startedAt === null) return undefined;
  const end = endedAt ?? Date.now();
  const seconds = Math.round((end - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export function formatResponseTokens(tokens: number) {
  if (tokens === 0) return undefined;

  return `${tokens.toLocaleString()} tokens`;
}

export function formatCost(cost: number) {
  if (cost === 0) return "$0";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatModel(model: SubagentModel | undefined) {
  if (isNil(model)) {
    return null;
  }

  return `${model.provider}/${model.model}:${model.thinking}`;
}
