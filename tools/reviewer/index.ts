import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { defineSubagent } from "../../packages/agent-kit";
import type { SubagentToolSpec } from "../../packages/agent-kit/types";
import { MODEL_CANDIDATES } from "./models";
import { buildPrompt, REVIEWER_SYSTEM_PROMPT } from "./prompt";
import { createReviewerTools } from "./tools";
import { ReviewerParams } from "./types";

const nativeTools: SubagentToolSpec[] = [
  { name: "read", type: "native" },
  { name: "grep", type: "native" },
  { name: "find", type: "native" },
  { name: "read_url", type: "native" },
  { name: "synthetic_web_search", type: "native" },
];

const extensionPaths = ["./extensions/tools", "npm:@aliou/pi-synthetic"];

export default async function reviewer(pi: ExtensionAPI): Promise<void> {
  const tools = [...nativeTools, ...createReviewerTools(pi)];

  const subagent = defineSubagent(pi, {
    name: "reviewer",
    label: "Reviewer",
    description:
      "Formal code review subagent for reviewing diffs without running checks.",
    systemPrompt: REVIEWER_SYSTEM_PROMPT,
    parameters: ReviewerParams,
    buildPrompt,
    tools,
    extensionPaths,
    models: MODEL_CANDIDATES,
  });

  subagent.subscribe(pi);

  pi.registerTool(subagent.tool);
  pi.registerTool(subagent.resumeTool);
}
