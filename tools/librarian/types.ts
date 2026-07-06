import { type Static, Type } from "typebox";

export const LibrarianParams = Type.Object({
  query: Type.String({
    description:
      "Self-contained remote or cross-repo codebase question. Include repo names/URLs/orgs, branch/version, feature/symbol, and desired output.",
  }),
  context: Type.Optional(
    Type.String({
      description:
        "Optional context: prior findings, constraints, comparison criteria, related issues/PRs, or why the answer matters.",
    }),
  ),
});

export type LibrarianParamsType = Static<typeof LibrarianParams>;
