import type { Api, Model } from "@earendil-works/pi-ai";

export type ModelIdentity = Pick<Model<Api>, "provider" | "id">;

export type KnownModelFamily =
  | "gpt-5.5"
  | "gpt-5.6"
  | "gpt-5.6-sol"
  | "gpt-5.6-terra"
  | "gpt-5.6-luna"
  | "glm-4.7-flash"
  | "glm-5.2"
  | "kimi-k2.7-code";

export function modelKey(model: ModelIdentity): string {
  return `${model.provider}/${model.id}`;
}

export function knownModelFamily(
  model: ModelIdentity,
): KnownModelFamily | undefined {
  const id = normalizedId(model);

  if (id === "gpt-5.5") return "gpt-5.5";
  if (id === "gpt-5.6") return "gpt-5.6";
  if (id === "gpt-5.6-sol") return "gpt-5.6-sol";
  if (id === "gpt-5.6-terra") return "gpt-5.6-terra";
  if (id === "gpt-5.6-luna") return "gpt-5.6-luna";
  if (id === "glm-4.7-flash" || id.startsWith("glm-4.7-flash-")) {
    return "glm-4.7-flash";
  }
  if (id === "glm-5.2" || id.startsWith("glm-5.2-")) return "glm-5.2";
  if (id === "kimi-k2.7-code") return "kimi-k2.7-code";

  return undefined;
}

function normalizedId(model: ModelIdentity): string {
  const id = model.id.toLowerCase();
  const hfPrefix = "hf:";
  const withoutHf = id.startsWith(hfPrefix) ? id.slice(hfPrefix.length) : id;
  return withoutHf.split("/").at(-1) ?? withoutHf;
}
