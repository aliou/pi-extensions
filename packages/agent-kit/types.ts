import type { ImageContent } from "@earendil-works/pi-ai";
import type {
  AgentSession,
  ExtensionContext,
  Skill,
  Theme,
  ToolDefinition,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import type { Static, TSchema } from "typebox";
import type { SubagentModel } from "./models";
import type { SubagentToolCall } from "./runtime/types";

export type { SubagentModel } from "./models";
export type { SubagentDetails, SubagentToolCall } from "./runtime";
export type { SubagentSessionRecord } from "./session-records";

export type SubagentRenderOptions = Pick<
  ToolRenderResultOptions,
  "expanded" | "isPartial"
>;

export type SubagentToolRenderer = (
  toolCall: SubagentToolCall,
  options: SubagentRenderOptions,
  theme: Theme,
) => Component;

export type SubagentToolSpec =
  | { name: string; type: "native"; render?: SubagentToolRenderer }
  | {
      name: string;
      type: "custom";
      spec: (cwd: string) => ToolDefinition;
      render?: SubagentToolRenderer;
    };

export interface SubagentPromptResult {
  text: string;
  images?: ImageContent[];
}

export interface SubagentSessionConfig {
  /**
   * When true (default), the subagent forwards the parent Pi session ID
   * to the provider, grouping all API calls under the parent session.
   * When false, the subagent uses its own session ID for provider calls.
   */
  inheritSessionId?: boolean;
}

export interface SubagentConfig<Params extends TSchema = TSchema> {
  name: string;
  label: string;
  description: string;
  promptGuidelines?: string[];
  systemPrompt: string;
  tools: SubagentToolSpec[];
  skills?: Skill[];
  extensionPaths?: string[];
  models: SubagentModel[];
  session?: SubagentSessionConfig;

  parameters: Params;
  buildPrompt: (
    params: Static<Params>,
    ctx: ExtensionContext,
  ) => SubagentPromptResult;
  resolveSkills?: (params: Static<Params>, ctx: ExtensionContext) => Skill[];
  beforeExecute?: (
    params: Static<Params>,
    session: AgentSession,
    ctx: ExtensionContext,
  ) => Promise<void>;
}
