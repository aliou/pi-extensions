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
import type { SubagentModelPreference } from "./models";
import type { ToolRenderContext } from "./runtime/render/types";
import type { SubagentToolCall } from "./runtime/types";

export type { SubagentResolvedModel as SubagentModel } from "./models";
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
  cwd: string,
) => Component;

export type SubagentHeaderRenderer<Params extends TSchema = TSchema> = (
  args: Static<Params>,
  theme: Theme,
  ctx: ToolRenderContext,
) => Component;

/**
 * Render extra call details (e.g. context, file list) shown only when the
 * subagent result is expanded. Return undefined to render nothing.
 */
export type SubagentDetailsRenderer<Params extends TSchema = TSchema> = (
  args: Static<Params>,
  theme: Theme,
  cwd: string,
) => Component | undefined;

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

/**
 * Resolve the subagent's tool set per invocation. Receives the validated tool
 * params and the extension context, and returns the tools to expose to the
 * subagent for that run. Mirrors `resolveSkills`.
 */
export type SubagentToolsResolver<Params extends TSchema = TSchema> = (
  params: Static<Params>,
  ctx: ExtensionContext,
) => SubagentToolSpec[] | Promise<SubagentToolSpec[]>;

export interface SubagentConfig<Params extends TSchema = TSchema> {
  name: string;
  label: string;
  description: string;
  promptGuidelines?: string[];
  systemPrompt: string;
  /**
   * Tools exposed to the subagent. May be a static list, or a function that
   * resolves the list per invocation from the tool params (e.g. to pick which
   * tools are present based on the request). The resolved list is also stashed
   * in `SubagentDetails.resolvedTools` so the renderer can look up per-tool
   * renderers without re-evaluating the function.
   */
  tools: SubagentToolSpec[] | SubagentToolsResolver<Params>;
  skills?: Skill[];
  extensionPaths?: string[];
  modelPreferences: SubagentModelPreference[];
  resumable?: boolean;

  parameters: Params;
  renderHeader?: SubagentHeaderRenderer<Params>;
  renderDetails?: SubagentDetailsRenderer<Params>;
  buildPrompt: (
    params: Static<Params>,
    ctx: ExtensionContext,
  ) => SubagentPromptResult | Promise<SubagentPromptResult>;
  resolveSkills?: (params: Static<Params>, ctx: ExtensionContext) => Skill[];
  beforeExecute?: (
    params: Static<Params>,
    session: AgentSession,
    ctx: ExtensionContext,
  ) => Promise<void>;
}
