import { type Static, Type } from "typebox";

export const ArtisanParams = Type.Object({
  task: Type.String({
    description:
      "Self-contained design, UX, or frontend craft task. Include the UI outcome, users, what good means, constraints, check signal, and decision needed.",
  }),
  context: Type.Optional(
    Type.String({
      description:
        "Optional product background, current UI state, user constraints, design-system notes, prior feedback, or acceptance criteria.",
    }),
  ),
  files: Type.Optional(
    Type.Array(
      Type.String({
        description:
          "Optional files, screenshots, mockups, component paths, or style/token paths to inspect.",
      }),
    ),
  ),
});

export type ArtisanParamsType = Static<typeof ArtisanParams>;
