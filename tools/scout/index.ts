import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import { buildPrompt, SCOUT_SYSTEM_PROMPT } from "./prompt";
import { renderScoutDetails, renderScoutHeader } from "./render";
import { createScoutTools } from "./tools";
import { ScoutParams } from "./types";

const extensionPaths = ["./tools/read", "./tools/find", "./tools/grep"];

export default async function scout(pi: ExtensionAPI): Promise<void> {
  const tools = createScoutTools(pi);

  const subagent = createSubagent(pi, {
    name: "scout",
    label: "Scout",
    description:
      "Local codebase-understanding subagent for code search, architecture tracing, and local git history analysis.",
    promptGuidelines: [
      "scout: Use for local codebase understanding, code search, architecture tracing, and local git history analysis.",
      "scout: Use when the repository or workspace is already available on disk.",
      "scout: Do not use for remote GitHub repositories or web research -- use librarian/read_url/synthetic_web_search instead.",
      "scout: Do not use for simple known-file reads or exact string searches -- use read/grep/find directly.",
    ],
    systemPrompt: SCOUT_SYSTEM_PROMPT,
    parameters: ScoutParams,
    resumable: true,
    renderHeader: renderScoutHeader,
    renderDetails: renderScoutDetails,
    buildPrompt,
    tools,
    extensionPaths,
    modelPreferences: [
      {
        provider: "openai-codex",
        model: "gpt-5.3-codex-spark",
        thinking: "medium",
        weight: 2,
      },
      {
        provider: "synthetic",
        model: "syn:small:text",
        thinking: "medium",
        weight: 1,
      },
      {
        provider: "synthetic",
        model: "syn:small:vision",
        thinking: "medium",
        weight: 1,
      },
      {
        provider: "neuralwatt",
        model: "qwen3.6-35b",
        thinking: "medium",
        weight: 1,
      },
    ],
  });

  subagent.register();
}
