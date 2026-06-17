import type { Skill } from "@earendil-works/pi-coding-agent";
import type { ModelPreferenceRecord } from "@harness/models";

export const SUBAGENT_SESSION_CUSTOM_TYPE = "subagent_session" as const;

export interface SubagentSessionRecord {
  type: typeof SUBAGENT_SESSION_CUSTOM_TYPE;
  name: string;
  sessionId: string;
  sessionFile: string;
  parentSessionId: string;
  model?: ModelPreferenceRecord;
  skills?: Skill[];
}
