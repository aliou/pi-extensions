import {
  getAgentDir,
  loadProjectContextFiles,
} from "@earendil-works/pi-coding-agent";
import type { SubagentAgentsFile } from "./types";

/** Load Pi's global and cwd-to-root AGENTS.md/CLAUDE.md context files. */
export function loadAgentsFilesFromCwd(cwd: string): SubagentAgentsFile[] {
  return loadProjectContextFiles({ cwd, agentDir: getAgentDir() });
}
