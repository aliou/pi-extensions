import type { Usage } from "@mariozechner/pi-ai";
import type { SubagentModel } from "../models";
import type { Maybe } from "../utils";

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
