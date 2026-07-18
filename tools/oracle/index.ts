import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent, loadAgentsFilesFromCwd } from "@harness/agent-kit";
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
      "Zero-shot senior technical advisor. Give a self-contained task, relevant context/files, constraints, and the decision or plan you need.",
    promptSnippet:
      "Senior technical advisor for architecture, code review, planning, trade-offs, and pragmatic implementation guidance.",
    promptGuidelines: [
      "oracle: Use for senior-level technical guidance, architecture advice, planning, and second opinions on design/code-review decisions.",
      "oracle: Do not use for simple lookups or file reads -- use read/grep/find directly instead.",
      "oracle: Make the task self-contained: include outcome, what good means, constraints, relevant paths/files, available evidence, verification signal, and desired final answer shape.",
      "oracle: Give a checkable target and say whether you want diagnosis only, options/trade-offs, or one recommended plan; avoid vague prompts like 'thoughts?' or 'look into this'.",
    ],
    systemPrompt: ORACLE_SYSTEM_PROMPT,
    parameters: OracleParams,
    resumable: true,
    renderHeader: renderOracleHeader,
    renderDetails: renderOracleDetails,
    buildPrompt,
    resolveAgentsFiles: (_params, ctx) => loadAgentsFilesFromCwd(ctx.cwd),
    tools,
    extensionPaths,
    // Primary: GPT-5.6 Sol at xhigh (oracle is quality-at-any-latency).
    // Fallback: synthetic GLM-5.2 at xhigh -> the synthetic shim maps xhigh to
    // "medium", which the GLM-5.2 chat template falls through to Max effort
    // (neuralwatt would map xhigh -> "max" directly). Used when openai-codex is
    // unavailable; ~9% bleed onto the fallback at weight 0.1.
    modelPreferences: [
      {
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        thinking: "xhigh",
        weight: 1,
      },
      {
        provider: "synthetic",
        model: "hf:zai-org/GLM-5.2",
        thinking: "xhigh",
        weight: 0.1,
      },
    ],
  });

  subagent.register();
}
