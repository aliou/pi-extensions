import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { scoutToolRenderers } from "../render";
import { createScoutGitLogTool } from "./git-log";
import { createScoutGitShowTool } from "./git-show";

export function createScoutTools(pi: ExtensionAPI): SubagentToolSpec[] {
  return [
    {
      name: "git_log",
      type: "custom",
      spec: (cwd) => createScoutGitLogTool(pi, cwd),
      render: scoutToolRenderers.git_log,
    },
    {
      name: "git_show",
      type: "custom",
      spec: (cwd) => createScoutGitShowTool(pi, cwd),
      render: scoutToolRenderers.git_show,
    },
    { name: "ls", type: "native", render: scoutToolRenderers.ls },
    { name: "read", type: "native", render: scoutToolRenderers.read },
    { name: "find", type: "native", render: scoutToolRenderers.find },
    { name: "grep", type: "native", render: scoutToolRenderers.grep },
  ];
}
