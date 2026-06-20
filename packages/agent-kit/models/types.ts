import type { Api, Model, ThinkingLevel } from "@earendil-works/pi-ai";

export interface SubagentModelPreference {
  provider: string;
  model: string;
  thinking: ThinkingLevel | "off";
  weight: number;
}

export interface SubagentResolvedModel {
  provider: string;
  model: string;
  thinking: ThinkingLevel | "off";
}

export interface SubagentSkippedModel {
  preference: SubagentResolvedModel;
  reason: string;
}

export interface SubagentModelChoice {
  model: Model<Api>;
  thinking: ThinkingLevel | "off";
  preference: SubagentResolvedModel;
  skipped: SubagentSkippedModel[];
}
