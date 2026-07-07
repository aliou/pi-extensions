/**
 * Model-aware routing for the edit tool family.
 *
 * Pure predicates and a routing decision. All `pi.*` side effects live in
 * `index.ts`; this module only decides which edit interface a model should use
 * based on its provider / id.
 */

type ModelLike = { provider?: string; id?: string } | undefined;

/**
 * Codex / GPT-style models were post-trained on the V4A `apply_patch` format.
 *
 * Detection is by provider only: the `openai-codex` provider serves models
 * post-trained on V4A. A broader id-based regex (e.g. `/^gpt-5/`) was
 * considered and rejected -- it would misroute any non-Codex provider that
 * happens to expose a `gpt-5*` id (proxies, fine-tunes, gateways) into
 * `apply_patch`, silently stripping `edit` and `write` from a model that was
 * not trained on V4A. Adding a Codex-trained model under a new provider means
 * routing it through `openai-codex` (or extending this predicate explicitly).
 */
export function isCodexModel(model: ModelLike): boolean {
  return model?.provider === "openai-codex";
}

/** Anthropic Claude models benefit from strict tool-use schema validation. */
export function isAnthropicModel(model: ModelLike): boolean {
  return model?.provider === "anthropic";
}

export type EditToolChoice = "apply_patch" | "edit";

/** Which edit interface the active model should use. */
export function pickEditTool(model: ModelLike): EditToolChoice {
  return isCodexModel(model) ? "apply_patch" : "edit";
}

/**
 * Compute the next active-tool set for an edit-interface swap.
 *
 * - `apply_patch` (Codex): drop `edit` and `write` (apply_patch's Add File
 *   covers creation), add `apply_patch`. `removedByUs` records what was dropped
 *   so it can be restored on exit.
 * - `edit` (everyone else): drop `apply_patch`, restore previously-removed
 *   tools, and ensure `edit` is present.
 *
 * Pure: `index.ts` owns the `currentChoice` / `removedByUs` state and the
 * `pi.setActiveTools` side effect.
 */
export function resolveActiveTools(
  active: string[],
  desired: EditToolChoice,
  removedByUs: string[],
): { active: string[]; removedByUs: string[] } {
  if (desired === "apply_patch") {
    const removed: string[] = [];
    const next = active.filter((t) => {
      if (t === "edit" || t === "write") {
        removed.push(t);
        return false;
      }
      return true;
    });
    const withPatch = next.includes("apply_patch")
      ? next
      : [...next, "apply_patch"];
    return { active: withPatch, removedByUs: removed };
  }

  let next = active.filter((t) => t !== "apply_patch");
  for (const t of removedByUs) {
    if (!next.includes(t)) next = [...next, t];
  }
  if (!next.includes("edit")) next = [...next, "edit"];
  return { active: next, removedByUs: [] };
}
