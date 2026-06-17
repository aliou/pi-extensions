import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { buildPrompt, ORACLE_SYSTEM_PROMPT } from "./prompt";
import {
  oracleToolRenderers,
  renderOracleDetails,
  renderOracleHeader,
} from "./render";
import { OracleParams } from "./types";

const tools: SubagentToolSpec[] = [
  { name: "read", type: "native", render: oracleToolRenderers.read },
  { name: "grep", type: "native", render: oracleToolRenderers.grep },
  { name: "find", type: "native", render: oracleToolRenderers.find },
  { name: "read_url", type: "native", render: oracleToolRenderers.read_url },
  {
    name: "find_sessions",
    type: "native",
    render: oracleToolRenderers.find_sessions,
  },
  {
    name: "read_session",
    type: "native",
    render: oracleToolRenderers.read_session,
  },
  {
    name: "synthetic_web_search",
    type: "native",
    render: oracleToolRenderers.synthetic_web_search,
  },
];

const extensionPaths = ["./tools", "npm:@aliou/pi-synthetic"];

export default async function oracle(pi: ExtensionAPI): Promise<void> {
  const subagent = createSubagent(pi, {
    name: "oracle",
    label: "Oracle",
    description:
      "Senior advisor subagent for technical guidance, code review, architecture advice, and planning.",
    promptGuidelines: [
      "oracle: Use for senior-level technical guidance, architecture advice, and planning.",
      "oracle: Use for code review when you need a second opinion on design decisions.",
      "oracle: Do not use for simple lookups or file reads -- use read/grep/find instead.",
    ],
    systemPrompt: ORACLE_SYSTEM_PROMPT,
    parameters: OracleParams,
    resumable: true,
    renderHeader: renderOracleHeader,
    renderDetails: renderOracleDetails,
    buildPrompt,
    tools,
    extensionPaths,
    modelGroup: "ad:advisor:technical",
  });

  subagent.register();
}
