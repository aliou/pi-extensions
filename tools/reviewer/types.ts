import { type Static, Type } from "typebox";

export const ReviewerParams = Type.Object({
  diff_description: Type.String({
    description:
      "Description of the diff or code change to review. Can be a git/bash command that generates the diff.",
  }),
  instructions: Type.Optional(
    Type.String({
      description: "Additional instructions for the review.",
    }),
  ),
});

export type ReviewerParamsType = Static<typeof ReviewerParams>;
