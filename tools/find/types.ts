import type { FindToolDetails } from "@earendil-works/pi-coding-agent";

export interface HarnessFindDetails extends FindToolDetails {
  relativeTo?: string;
  totalResults?: number;
  paths?: string[];
}
