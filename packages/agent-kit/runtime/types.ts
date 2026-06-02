import type { Usage } from "@earendil-works/pi-ai";
import type { Maybe } from "@harness/utils";
import type { SubagentModel } from "../models";

export type SubagentToolCallStatus = "running" | "success" | "error";

export type SubagentActivityItem =
  | {
      type: "thinking";
      startedAt: number;
      endedAt: Maybe<number>;
      content: string;
    }
  | {
      type: "tool_call";
      toolCallId: string;
      startedAt: number;
    };

export interface SubagentToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;

  status: SubagentToolCallStatus;

  startedAt: number;
  endedAt: Maybe<number>;

  error: Maybe<string>;
}

export type SubagentStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "aborted";

export interface SubagentDetails {
  sessionId: string;
  sessionFile: string;

  model?: SubagentModel;
  prompt: string;
  params?: unknown;

  status: SubagentStatus;
  thinking: boolean;

  toolCalls: SubagentToolCall[];
  activity: SubagentActivityItem[];
  usage: Usage;
  responseTokens: number;

  response?: string;
  error?: string;

  startedAt: Maybe<number>;
  endedAt: Maybe<number>;
}
