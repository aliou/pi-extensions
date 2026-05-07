import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { SubagentDetails } from "../types";

export type ToolRenderContext = Parameters<
  NonNullable<
    ToolDefinition<Record<string, unknown>, SubagentDetails>["renderCall"]
  >
>[2];
