import type { Usage } from "@earendil-works/pi-ai";
import type { SubagentModel } from "@harness/agent-kit/models";
import { type Static, Type } from "typebox";

export const QQ_ANSWER_TYPE = "qq:answer";
export const QQ_CONTEXT_TYPE = "qq:context";

export const QqParams = Type.Object({
  prompt: Type.String(),
});

export type QqParamsType = Static<typeof QqParams>;

export interface QqAnswerDetails {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
  usage: Usage;
  model?: SubagentModel;
}

export interface QqContextDetails {
  qqId: string;
  insertedAt: number;
  answer: QqAnswerDetails;
}
