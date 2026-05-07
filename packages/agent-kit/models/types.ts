import type { ThinkingLevel } from "@earendil-works/pi-ai";

export interface SubagentModel {
  provider: string;
  model: string;
  thinking: ThinkingLevel | "off";
  weight: number;
}

export interface SubagentResolvedModel {
  provider: string;
  model: string;
  thinkingLevel: ThinkingLevel | "off";
}
