import { type Static, Type } from "typebox";

export const ArtisanParams = Type.Object({
  task: Type.String({
    description:
      "The design, UX, or frontend craft task you want the artisan to help with.",
  }),
  context: Type.Optional(
    Type.String({
      description:
        "Optional background context, product goals, user constraints, or design-system notes.",
    }),
  ),
  files: Type.Optional(
    Type.Array(
      Type.String({
        description:
          "Optional files, screenshots, or implementation paths for analysis.",
      }),
    ),
  ),
});

export type ArtisanParamsType = Static<typeof ArtisanParams>;
