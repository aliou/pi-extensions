import { jobs } from "./registry";
import type { ModelCandidate, ModelJob } from "./types";

/**
 * Minimal interface for checking model availability.
 * Matches Pi's ModelRegistry subset needed for auth filtering.
 */
export interface ModelAvailability {
  find(
    provider: string,
    modelId: string,
  ): { readonly provider: string; readonly id: string } | undefined;
  hasConfiguredAuth(model: {
    readonly provider: string;
    readonly id: string;
  }): boolean;
}

/**
 * Return candidates for a job. When a model registry is provided,
 * only candidates with configured auth are returned.
 */
function get(
  job: ModelJob,
  modelRegistry?: ModelAvailability,
): ModelCandidate[] {
  if (!modelRegistry) return jobs[job];

  return jobs[job].filter((c) => {
    const model = modelRegistry.find(c.provider, c.model);
    return model != null && modelRegistry.hasConfiguredAuth(model);
  });
}

export const registry = { get };

export type { ModelCandidate, ModelJob };
