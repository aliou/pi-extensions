import Type from "typebox";

export const LookAtParams = Type.Object({
  path: Type.String({
    description: "Path to the image file to analyze (relative or absolute).",
  }),
  objective: Type.String({
    description:
      "What you want to learn from this image (e.g., 'describe the UI layout', 'extract the error message', 'read the text in this diagram').",
  }),
  context: Type.Optional(
    Type.String({
      description:
        "Broader context for why you need this analysis. Helps the vision model focus on what matters.",
    }),
  ),
});
