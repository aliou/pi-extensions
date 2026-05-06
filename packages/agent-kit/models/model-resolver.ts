import type { Api, Model, ThinkingLevel } from "@mariozechner/pi-ai";
import type { ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { SubagentModel, SubagentResolvedModel } from "./types";

export interface SubagentModelSelection {
  model: Model<Api>;
  thinkingLevel: ThinkingLevel | "off";
  record: SubagentResolvedModel;
}

export function isSubagentResolvedModel(
  data: unknown,
): data is SubagentResolvedModel {
  return (
    typeof data === "object" &&
    data !== null &&
    "provider" in data &&
    "model" in data &&
    "thinkingLevel" in data &&
    typeof data.provider === "string" &&
    typeof data.model === "string" &&
    typeof data.thinkingLevel === "string"
  );
}

export class SubagentModelResolver {
  constructor(private candidates: SubagentModel[]) {}

  pick(modelRegistry: ModelRegistry): SubagentModelSelection | null {
    const candidate = this.pickCandidate(modelRegistry);
    if (!candidate) return null;

    return this.toSelection(candidate);
  }

  resolve(
    stored: SubagentResolvedModel | undefined,
    modelRegistry: ModelRegistry,
  ): SubagentModelSelection | null {
    if (stored) {
      const model = modelRegistry.find(stored.provider, stored.model);
      if (model) {
        return {
          model,
          thinkingLevel: stored.thinkingLevel,
          record: stored,
        };
      }
    }

    return this.pick(modelRegistry);
  }

  private pickCandidate(
    modelRegistry: ModelRegistry,
  ): { model: Model<Api>; config: SubagentModel } | null {
    if (this.candidates.length === 0) return null;

    const totalWeight = this.candidates.reduce(
      (sum, candidate) => sum + candidate.weight,
      0,
    );
    let roll = Math.random() * totalWeight;

    for (const candidate of this.candidates) {
      roll -= candidate.weight;
      if (roll <= 0) {
        const model = modelRegistry.find(candidate.provider, candidate.model);
        if (model) return { model, config: candidate };
      }
    }

    for (const candidate of this.candidates) {
      const model = modelRegistry.find(candidate.provider, candidate.model);
      if (model) return { model, config: candidate };
    }

    return null;
  }

  private toSelection(selection: {
    model: Model<Api>;
    config: SubagentModel;
  }): SubagentModelSelection {
    const thinkingLevel = this.normalizeThinkingLevel(
      selection.config.thinking,
    );

    return {
      model: selection.model,
      thinkingLevel,
      record: {
        provider: selection.config.provider,
        model: selection.config.model,
        thinkingLevel,
      },
    };
  }

  private normalizeThinkingLevel(
    thinkingLevel: ThinkingLevel | "off",
  ): ThinkingLevel | "off" {
    return thinkingLevel;
  }
}
