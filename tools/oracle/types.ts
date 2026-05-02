import { type Static, Type } from "typebox";

export const OracleParams = Type.Object({
  task: Type.String({
    description: "The task or question you want the oracle to help with.",
  }),
  context: Type.Optional(
    Type.String({
      description: "Optional background context.",
    }),
  ),
  files: Type.Optional(
    Type.Array(
      Type.String({
        description: "Optional attached files for analysis.",
      }),
    ),
  ),
});

export type OracleParamsType = Static<typeof OracleParams>;
