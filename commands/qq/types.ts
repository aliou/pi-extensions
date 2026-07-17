import type { Usage } from "@earendil-works/pi-ai";
import type { SubagentModel } from "@harness/agent-kit/models";
import { type Static, Type } from "typebox";

export const QQ_ANSWER_TYPE = "qq:answer";

export const QqParams = Type.Object({
  prompt: Type.String(),
});

export type QqParamsType = Static<typeof QqParams>;

export interface QqAnswerDetails {
  id: string;
  /** Subagent session this answer belongs to. Links the answer to its
   * resumable qq thread. Legacy answers (persisted before this field) fall
   * back to their own `id` so each is treated as a one-question session. */
  subagentSessionId: string;
  question: string;
  answer: string;
  createdAt: number;
  usage: Usage;
  model?: SubagentModel;
}

/** Inputs for running a qq subagent, either new or resuming an existing thread. */
export type QqRunSpec =
  | {
      mode: "new";
      question: string;
      systemPrompt: string;
      userMessage: string;
    }
  | {
      mode: "resume";
      sessionId: string;
      question: string;
      systemPrompt: string;
      userMessage: string;
    };
