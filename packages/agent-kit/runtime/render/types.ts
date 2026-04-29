import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { SubagentDetails } from "../types";

export type ToolRenderContext = Parameters<
  NonNullable<
    ToolDefinition<Record<string, unknown>, SubagentDetails>["renderCall"]
  >
>[2];
