import type { SubagentUsage } from "@subagents/lib/types";

export const BTW_MESSAGE_TYPE = "btw";

export type BtwDetails = {
  question: string;
  answer: string;
  provider: string;
  model: string;
  timestamp: number;
  usage?: SubagentUsage;
  runId?: string;
  totalDurationMs?: number;
};
