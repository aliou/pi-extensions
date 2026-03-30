/**
 * Types for the read_session tool.
 */

import type { SubagentToolCall, SubagentUsage } from "@subagents/lib/types";

export interface ReadSessionInput {
  sessionId: string;
  goal: string;
}

export interface ReadSessionDetails {
  sessionId: string;
  goal: string;
  resolvedPath?: string;
  toolCalls: SubagentToolCall[];
  response?: string;
  aborted?: boolean;
  error?: string;
  usage?: SubagentUsage;
  resolvedModel?: { provider: string; id: string };
  totalDurationMs?: number;
}
