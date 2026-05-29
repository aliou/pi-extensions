import type { ThinkingLevel } from "@earendil-works/pi-ai";

export type ModelJob =
  | "ad:small:text"
  | "ad:large:text"
  | "ad:small:vision"
  | "ad:large:vision"
  | "ad:small:sota"
  | "ad:medium:sota"
  | "ad:large:sota";

export interface ModelCandidate {
  provider: string;
  model: string;
  thinking: ThinkingLevel | "off";
}
