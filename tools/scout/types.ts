import { type Static, Type } from "typebox";

export const ScoutParams = Type.Object({
  query: Type.String({
    description: "Question about the local codebase.",
  }),
  context: Type.Optional(
    Type.String({
      description: "Optional context.",
    }),
  ),
  cwd: Type.Optional(
    Type.String({
      description:
        "Local codebase path to inspect. Defaults to the current working directory.",
    }),
  ),
});

export type ScoutParamsType = Static<typeof ScoutParams>;
