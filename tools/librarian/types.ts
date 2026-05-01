import { type Static, Type } from "typebox";

export const LibrarianParams = Type.Object({
  query: Type.String({
    description: "Question about the codebase.",
  }),
  context: Type.Optional(
    Type.String({
      description: "Optional context.",
    }),
  ),
});

export type LibrarianParamsType = Static<typeof LibrarianParams>;
