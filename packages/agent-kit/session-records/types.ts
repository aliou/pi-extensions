import type { Skill } from "@mariozechner/pi-coding-agent";
import type { SubagentResolvedModel } from "../models";

export const SUBAGENT_SESSION_CUSTOM_TYPE = "subagent_session" as const;

export interface SubagentSessionRecord {
  type: typeof SUBAGENT_SESSION_CUSTOM_TYPE;
  name: string;
  sessionId: string;
  sessionFile: string;
  parentSessionId: string;
  model?: SubagentResolvedModel;
  skills?: Skill[];
}
