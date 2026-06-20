import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type {
  SubagentModelChoice,
  SubagentModelPreference,
  SubagentResolvedModel,
  SubagentSkippedModel,
} from "./types";

/**
 * Pick a model for a fresh subagent run.
 *
 * Filters the preference list down to models the registry knows about and
 * that have auth configured, then selects one with weighted randomness. Each
 * preference's `weight` is a multiplier: the probability of a usable model
 * being chosen is its weight divided by the total weight of all usable models.
 */
export function pickModel(
  registry: ModelRegistry,
  preferences: readonly SubagentModelPreference[],
): SubagentModelChoice | null {
  const skipped: SubagentSkippedModel[] = [];
  const usable: SubagentModelPreference[] = [];

  for (const preference of preferences) {
    const reason = usabilityReason(registry, preference);
    if (reason) {
      skipped.push({ preference: recordFor(preference), reason });
      continue;
    }
    usable.push(preference);
  }

  const chosen = weightedPick(usable);
  if (!chosen) return null;

  const model = registry.find(chosen.provider, chosen.model);
  if (!model) return null;

  return {
    model,
    thinking: chosen.thinking,
    preference: recordFor(chosen),
    skipped,
  };
}

/**
 * Resolve the model for a resumed subagent run. Prefers the pinned model from
 * the session record when it is still authed; otherwise falls back to
 * {@link pickModel}.
 */
export function resolveModel(
  registry: ModelRegistry,
  preferences: readonly SubagentModelPreference[],
  pinned?: SubagentResolvedModel,
): SubagentModelChoice | null {
  if (pinned && !usabilityReason(registry, { ...pinned, weight: 1 })) {
    const model = registry.find(pinned.provider, pinned.model);
    if (model) {
      return {
        model,
        thinking: pinned.thinking,
        preference: pinned,
        skipped: [],
      };
    }
  }

  return pickModel(registry, preferences);
}

function usabilityReason(
  registry: ModelRegistry,
  preference: SubagentModelPreference,
): string | null {
  const model = registry.find(preference.provider, preference.model);
  if (!model) return "unknown-model";
  if (!registry.hasConfiguredAuth(model)) return "unauthed";
  return null;
}

function recordFor(preference: SubagentModelPreference): SubagentResolvedModel {
  return {
    provider: preference.provider,
    model: preference.model,
    thinking: preference.thinking,
  };
}

function weightedPick(
  entries: SubagentModelPreference[],
): SubagentModelPreference | null {
  if (entries.length === 0) return null;

  const weights = entries.map((e) => Math.max(0, e.weight));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    // All weights zero/non-positive: fall back to uniform selection so a
    // misconfigured roster still picks something.
    return entries[Math.floor(Math.random() * entries.length)] ?? null;
  }

  let roll = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll < 0) return entries[i] ?? null;
  }
  return entries[entries.length - 1] ?? null;
}
