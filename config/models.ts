export type ModelFamily = "claude" | "gpt" | "gemini" | "other";

export function getModelFamily(modelId: string): ModelFamily {
  if (modelId.startsWith("claude")) return "claude";
  if (modelId.startsWith("gpt")) return "gpt";
  if (modelId.includes("gemini")) return "gemini";
  return "other";
}
