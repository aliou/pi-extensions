import { type Static, Type } from "typebox";

export const ReadSessionParams = Type.Object({
  targetSessionId: Type.String({ description: "Session UUID" }),
  goal: Type.String({
    description: "What information to extract from the session",
  }),
});

export type ReadSessionParamsType = Static<typeof ReadSessionParams>;

export interface ReadSessionState {
  targetSessionId: string;
  goal: string;
}
