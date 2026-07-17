import type { QqAnswerDetails } from "./types";

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatCost(cost: number): string {
  if (cost === 0) return "$0";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatFooter(details: QqAnswerDetails): string {
  const parts: string[] = [];
  const { usage } = details;

  if (usage.input > 0) parts.push(`↑${formatTokenCount(usage.input)}`);
  if (usage.output > 0) parts.push(`↓${formatTokenCount(usage.output)}`);
  if (usage.cacheRead > 0) parts.push(`R${formatTokenCount(usage.cacheRead)}`);
  if (usage.cacheWrite > 0)
    parts.push(`W${formatTokenCount(usage.cacheWrite)}`);
  if (usage.cost.total > 0) parts.push(formatCost(usage.cost.total));

  if (details.model) {
    parts.push(`(${details.model.provider}/${details.model.model})`);
  }

  return parts.join(" ");
}

/** First displayable line of a question, control chars replaced with spaces. */
export function safeFirstLine(text: string): string {
  return Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0);
      if (code === undefined) return "";
      return code < 32 || code === 127 ? " " : char;
    })
    .join("")
    .trim();
}

/** "3 questions" on wide terminals, "3q" when width is tight. */
export function formatQuestionCount(count: number, narrow: boolean): string {
  if (count <= 1) return narrow ? "1q" : "1 question";
  return narrow ? `${count}q` : `${count} questions`;
}
