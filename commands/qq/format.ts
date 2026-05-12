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

export function buildSideChatContext(details: QqAnswerDetails): string {
  return `The following context comes from a side chat. Use it as supporting context for the current task.\n\n<side_chat_context id="${escapeXmlAttribute(details.id)}">\n  <user_prompt>\n${indent(escapeXmlText(details.question), 4)}\n  </user_prompt>\n  <assistant_response>\n${indent(escapeXmlText(details.answer), 4)}\n  </assistant_response>\n</side_chat_context>`;
}

function indent(text: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function escapeXmlText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXmlAttribute(text: string): string {
  return escapeXmlText(text).replaceAll('"', "&quot;");
}
