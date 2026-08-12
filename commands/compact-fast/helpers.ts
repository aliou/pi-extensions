import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import {
  pickModel,
  type SubagentModelPreference,
} from "@harness/agent-kit/models";

/**
 * Config key for the compact-fast model roster in
 * `$PI_CODING_AGENT_DIR/settings/subagent-models.json`, alongside the
 * subagent rosters. Same file, same format, same resolution mechanism.
 */
export const COMPACT_FAST_NAME = "compact_fast";

export function isSameModel(a: Model<Api>, b: Model<Api>): boolean {
  return a.provider === b.provider && a.id === b.id;
}

/**
 * Pick a compaction model from a roster using the same ranking mechanism as
 * subagents: weighted random sampling for positive weights, zero/negative
 * weights as ordered fallbacks, and unknown or unauthed entries skipped.
 * Returns the first ranked candidate, or undefined when the roster is empty
 * or nothing resolves.
 */
export function pickCompactFastModel(
  registry: ModelRegistry,
  preferences: readonly SubagentModelPreference[],
): Model<Api> | undefined {
  return pickModel(registry, preferences)?.model;
}
