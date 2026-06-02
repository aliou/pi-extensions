import type { ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import { keyHint } from "@earendil-works/pi-coding-agent";
import { isNotNil } from "@harness/utils";
import type { SubagentDetails } from "../types";
import {
  formatCost,
  formatDuration,
  formatModel,
  formatResponseTokens,
} from "./utils";

export function formatCollapsedHint(
  details: SubagentDetails,
  options: ToolRenderResultOptions,
  prefix?: string,
) {
  const hint = keyHint(
    "app.tools.expand",
    options.expanded ? "to collapse" : "to expand",
  );
  const metadata = [
    prefix ? `${prefix}, ${hint}` : hint,
    formatModel(details.model),
    formatDuration(details.startedAt, details.endedAt),
    formatCost(details.usage.cost.total),
    formatResponseTokens(details.responseTokens),
  ]
    .filter(isNotNil)
    .join(" · ");

  return metadata;
}
