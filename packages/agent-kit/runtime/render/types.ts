import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { SubagentDetails } from "../types";

export type ToolRenderContext<TState = unknown> = Parameters<
  NonNullable<
    ToolDefinition<
      Record<string, unknown>,
      SubagentDetails,
      TState
    >["renderCall"]
  >
>[2];

export type SubagentRenderState = {
  interval?: NodeJS.Timeout;
};
