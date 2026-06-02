import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { MODEL_CANDIDATES } from "./models";
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
      "Formal code review subagent for reviewing diffs without running checks.",
    promptGuidelines: [
      "reviewer: Use for formal code review of diffs and code changes.",
      "reviewer: Does not run checks or tests -- only reviews code statically.",
      "reviewer: Do not use for general questions or file reads -- use oracle or read instead.",
    ],
    systemPrompt: REVIEWER_SYSTEM_PROMPT,
    parameters: ReviewerParams,
    resumable: true,
    renderHeader: renderReviewerHeader,
    renderDetails: renderReviewerDetails,
    buildPrompt,
    tools,
    extensionPaths,
    models: MODEL_CANDIDATES,
  });

  subagent.register();
}
