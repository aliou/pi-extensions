import { type Static, Type } from "typebox";

export const QqParams = Type.Object({
  prompt: Type.String(),
});

export type QqParamsType = Static<typeof QqParams>;
