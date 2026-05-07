import type { GrepToolDetails } from "@earendil-works/pi-coding-agent";

export interface RgMatch {
  filePath: string;
  lineNumber: number;
}

export interface GrepMatchData {
  path: string;
  line: number;
  text: string;
}

export interface HarnessGrepDetails extends GrepToolDetails {
  relativeTo?: string;
  matchCount?: number;
  matches?: GrepMatchData[];
}
