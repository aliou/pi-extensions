import type { ToolRenderResultOptions } from "@mariozechner/pi-coding-agent";
import { keyHint } from "@mariozechner/pi-coding-agent";
import { isNotNil } from "../../utils";
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
) {
  const hint = keyHint(
    "app.tools.expand",
    options.expanded ? "to collapse" : "to expand",
  );
  const metadata = [
    hint,
    formatModel(details.model),
    formatDuration(details.startedAt, details.endedAt),
    formatCost(details.usage.cost.total),
    formatResponseTokens(details.responseTokens),
  ]
    .filter(isNotNil)
    .join(" · ");

  return metadata;
}
