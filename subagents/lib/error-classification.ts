/**
 * Error classification helpers for subagent failures.
 */

import type { SubagentResult } from "@subagents/lib/types";

/**
 * Detect model availability/routing/auth failures that should fail the whole tool call.
 */
export function isModelAvailabilityError(message: string): boolean {
  const text = message.toLowerCase();

  return [
    "no route found for model",
    "model_not_found",
    "unknown model",
    "not found on provider",
    "no valid api key is configured",
    "exists on",
  ].some((needle) => text.includes(needle));
}

/**
 * True when a subagent failed because the configured model is unavailable.
 */
export function shouldFailToolCallForModelIssue(
  result: SubagentResult,
): boolean {
  const stopReason = result.stopReason?.toLowerCase();
  const combined = [result.providerErrorMessage, result.error]
    .filter(Boolean)
    .join("\n");

  if (!combined) return false;

  // Prefer hard signal from model turn error, but allow fallback when stopReason isn't populated.
  if (stopReason && stopReason !== "error") return false;

  return isModelAvailabilityError(combined);
}
