import type { Static, TSchema } from "typebox";
import Type from "typebox";

export function createResumeSubagentParamsSchema(parameters: TSchema) {
  return Type.Interface([parameters], {
    sessionId: Type.String({
      description: `Existing subagent session ID to resume. Use a sessionId returned by a previous call.`,
    }),
  });
}

export type ResumeSubagentParams<Params extends TSchema> = Static<Params> & {
  sessionId: string;
};
