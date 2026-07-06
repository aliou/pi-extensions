import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { buildPrompt, REVIEWER_SYSTEM_PROMPT } from "./prompt";
import {
  renderReviewerDetails,
  renderReviewerHeader,
  reviewerToolRenderers,
} from "./render";
import { createReviewerTools } from "./tools";
import { ReviewerParams } from "./types";

const nativeTools: SubagentToolSpec[] = [
  { name: "read", type: "native", render: reviewerToolRenderers.read },
  { name: "grep", type: "native", render: reviewerToolRenderers.grep },
  { name: "find", type: "native", render: reviewerToolRenderers.find },
  { name: "read_url", type: "native", render: reviewerToolRenderers.read_url },
  {
    name: "synthetic_web_search",
    type: "native",
    render: reviewerToolRenderers.synthetic_web_search,
  },
];

const extensionPaths = ["./tools", "npm:@aliou/pi-synthetic"];

export default async function reviewer(pi: ExtensionAPI): Promise<void> {
  const tools = [...nativeTools, ...createReviewerTools(pi)];

  const subagent = createSubagent(pi, {
    name: "reviewer",
    label: "Reviewer",
    description:
      "Zero-shot formal code reviewer. Provide the exact diff command/description plus focused review criteria; it reviews statically and does not run checks.",
    promptSnippet:
      "Formal code review subagent for diffs and code changes; static analysis only, no test execution.",
    promptGuidelines: [
      "reviewer: Use for formal code review of diffs and code changes.",
      "reviewer: Does not run checks or tests -- only reviews code statically.",
      "reviewer: Do not use for general questions or file reads -- use oracle or read instead.",
      "reviewer: GPT-5.5 works best with outcome-first prompts. State the review outcome, severity bar, invariants, risk areas, how correctness would be verified, and desired finding format; avoid process-heavy instructions beyond required review criteria.",
      "reviewer: GPT-5.5 is literal. Give a checkable review target and say what evidence would make findings useful; avoid vague prompts like 'review this' without a diff scope or risk focus.",
      "reviewer: Provide an exact diff description or command that works from the current cwd, such as 'git diff --staged' or 'git diff main...HEAD'.",
      "reviewer: Put review focus in instructions: risk areas, expected behavior, backwards-compatibility, security/performance concerns, and whether to prioritize only blocking issues.",
      "reviewer: Do not ask reviewer to fix code, run tests, approve PRs, or leave PR comments; ask for cited findings with severity and concrete remediation.",
      "reviewer: If the diff is large, ask for the highest-impact findings first and explicit residual risks instead of exhaustive commentary.",
    ],
    systemPrompt: REVIEWER_SYSTEM_PROMPT,
    parameters: ReviewerParams,
    resumable: true,
    renderHeader: renderReviewerHeader,
    renderDetails: renderReviewerDetails,
    buildPrompt,
    tools,
    extensionPaths,
    // Primary: gpt-5.5 at medium (balanced default per OpenAI guidance).
    // Fallback: synthetic GLM-5.2 at high. ~9% bleed at weight 0.1; takes over
    // when openai-codex is unavailable.
    modelPreferences: [
      {
        provider: "openai-codex",
        model: "gpt-5.5",
        thinking: "medium",
        weight: 1,
      },
      {
        provider: "synthetic",
        model: "hf:zai-org/GLM-5.2",
        thinking: "high",
        weight: 0.1,
      },
    ],
  });

  subagent.register();
}
