import type { SubagentModel } from "../../types";
import type { Maybe } from "../../utils";
import { isNil } from "../../utils";

export function extractParagraphs(content: string, count: number) {
  return content
    .trim()
    .split(/\n\s*\n/)
    .slice(0, count)
    .join("\n\n")
    .trim();
}

export function formatDuration(
  startedAt: Maybe<number>,
  endedAt: Maybe<number>,
) {
  if (startedAt === null || endedAt === null) return undefined;
  const seconds = Math.round((endedAt - startedAt) / 1000);
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
