/**
 * Jester subagent types.
 */

import type { SubagentToolCall, SubagentUsage } from "@subagents/lib/types";

/** Input parameters for the jester subagent */
export interface JesterInput {
  /** The question to answer */
  question: string;
}

/** Details structure for jester tool rendering */
export interface JesterDetails {
  /** Tool call ID used as cache key for render component reuse */
  _renderKey?: string;

  /** Question input */
  question: string;

  /** Tool calls made by the subagent (always empty for jester) */
  toolCalls: SubagentToolCall[];

  /** The jester's response (for final result) */
  response?: string;

  /** Whether the request was aborted */
  aborted?: boolean;

  /** Error message if failed */
  error?: string;

  /** Usage stats from the subagent */
  usage?: SubagentUsage;

  /** Resolved model used for this run (provider + model id) */
  resolvedModel?: { provider: string; id: string };
}
