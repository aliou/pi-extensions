import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { ADVISOR_SYSTEM_PROMPT, buildPrompt } from "./prompt";
import {
  advisorToolRenderers,
  renderAdvisorDetails,
  renderAdvisorHeader,
} from "./render";
import { AdvisorParams } from "./types";

const tools: SubagentToolSpec[] = [
  { name: "read", type: "native", render: advisorToolRenderers.read },
  { name: "grep", type: "native", render: advisorToolRenderers.grep },
  { name: "find", type: "native", render: advisorToolRenderers.find },
  { name: "read_url", type: "native", render: advisorToolRenderers.read_url },
  {
    name: "find_sessions",
    type: "native",
    render: advisorToolRenderers.find_sessions,
  },
  {
    name: "read_session",
    type: "native",
    render: advisorToolRenderers.read_session,
  },
  {
    name: "synthetic_web_search",
    type: "native",
    render: advisorToolRenderers.synthetic_web_search,
  },
];

const extensionPaths = [
  "./tools",
  "npm:@aliou/pi-synthetic",
  "./hooks/provider-tweaks",
];

export default async function advisor(pi: ExtensionAPI): Promise<void> {
  const subagent = createSubagent(pi, {
    name: "advisor",
    label: "Advisor",
    description:
      "Zero-shot strategic advisor. Use for hard decisions, stuck work, risk review, and pre-completion second opinions.",
    promptSnippet:
      "Strategic second-opinion advisor for hard decisions, recurring failures, risk review, and pre-completion checks.",
    promptGuidelines: [
      "advisor: Use for hard decisions, recurring failures, architecture/risk trade-offs, and before declaring complex work done.",
      "advisor: Do not use for simple lookups, obvious one-line edits, routine formatting, or work where the next action is dictated by already-read tool output.",
      "advisor: Make the task self-contained. Include the task, current evidence, attempted approach, constraints, specific uncertainty, and decision needed.",
      "advisor: Prefer calling after read-only orientation but before writing or state-changing commands on multi-step tasks.",
      "advisor: Include files when file-specific claims matter; ask for concise guidance the main agent can apply immediately.",
    ],
    systemPrompt: ADVISOR_SYSTEM_PROMPT,
    parameters: AdvisorParams,
    resumable: true,
    renderHeader: renderAdvisorHeader,
    renderDetails: renderAdvisorDetails,
    buildPrompt,
    tools,
    extensionPaths,
    // Primary: Claude Fable 5 at high effort. Fable is best for hard,
    // ambiguous, long-horizon judgment. Opus 4.8 is configured at xhigh effort
    // with weight 0, so it is selected only when Fable is unavailable or
    // unauthenticated, not as random bleed.
    modelPreferences: [
      {
        provider: "anthropic",
        model: "claude-fable-5",
        thinking: "high",
        weight: 1,
      },
      {
        provider: "anthropic",
        model: "claude-opus-4-8",
        thinking: "xhigh",
        weight: 0,
      },
    ],
  });

  subagent.register();
}
