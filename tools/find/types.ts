import type { FindToolDetails } from "@mariozechner/pi-coding-agent";

export interface HarnessFindDetails extends FindToolDetails {
  relativeTo?: string;
  totalResults?: number;
  paths?: string[];
}
