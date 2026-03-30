/**
 * Oracle tools aggregator.
 *
 * Oracle is advisory-only and doesn't use tools.
 */

import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

/**
 * Create oracle tools (empty - oracle is advisory only).
 */
export function createOracleTools(): ToolDefinition[] {
  return [];
}
