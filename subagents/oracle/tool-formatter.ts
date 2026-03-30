/**
 * Tool call formatter for oracle subagent.
 *
 * Oracle doesn't use tools - this is a placeholder for consistency.
 */

import type { SubagentToolCall } from "@subagents/lib/types";

/**
 * Format a tool call for human-readable display.
 * Oracle doesn't use tools, so this should never be called.
 */
export function formatOracleToolCall(_toolCall: SubagentToolCall): {
  label: string;
  detail?: string;
} {
  return {
    label: "Unknown",
  };
}
