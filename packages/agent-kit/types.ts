import type { ImageContent } from "@mariozechner/pi-ai";
import type {
  AgentSession,
  ExtensionContext,
  Skill,
  ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import type { Static, TSchema } from "typebox";
import type { SubagentModel } from "./models";

export type { SubagentModel } from "./models";
export type { SubagentDetails, SubagentToolCall } from "./runtime";
export type { SubagentSessionRecord } from "./session-records";

export type SubagentToolSpec =
  | { name: string; type: "native" }
  | { name: string; type: "custom"; spec: (cwd: string) => ToolDefinition };

export interface SubagentPromptResult {
  text: string;
  images?: ImageContent[];
}

export interface SubagentConfig<Params extends TSchema = TSchema> {
  name: string;
  label: string;
  description: string;
  systemPrompt: string;
  tools: SubagentToolSpec[];
  skills?: Skill[];
  extensionPaths?: string[];
  models: SubagentModel[];

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
