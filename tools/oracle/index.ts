import { defineSubagent } from "@harness/agent-kit";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { MODEL_CANDIDATES } from "./models";
import { buildPrompt, ORACLE_SYSTEM_PROMPT } from "./prompt";
import { OracleParams } from "./types";

const tools: SubagentToolSpec[] = [
  { name: "read", type: "native" },
  { name: "grep", type: "native" },
  { name: "find", type: "native" },
  { name: "read_url", type: "native" },
  { name: "find_sessions", type: "native" },
  { name: "read_session", type: "native" },
  { name: "synthetic_web_search", type: "native" },
];

const extensionPaths = [
  "./tools",
  "./extensions/breadcrumbs",
  "npm:@aliou/pi-synthetic",
];

export default async function oracle(pi: ExtensionAPI): Promise<void> {
  const subagent = defineSubagent(pi, {
    name: "oracle",
    label: "Oracle",
    description:
      "Senior advisor subagent for technical guidance, code review, architecture advice, and planning.",
    systemPrompt: ORACLE_SYSTEM_PROMPT,
    parameters: OracleParams,
    buildPrompt,
    tools,
    extensionPaths,
    models: MODEL_CANDIDATES,
  });

  subagent.subscribe(pi);

  pi.registerTool(subagent.tool);
  pi.registerTool(subagent.resumeTool);
}
