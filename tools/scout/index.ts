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
    // Primary: synthetic GLM-5.2 (524k ctx; the context-overflow failure mode
    // that killed spark is structurally impossible). Fallback: neuralwatt glm-5.2
    // (1M ctx) -- same model on the other provider. Synthetic is the subscription
    // (free) path; neuralwatt is the paid fallback.
    // GLM-5.2 exposes only off/high/xhigh; "low" clamps up to "high" on both
    // providers, so primary and fallback stay consistent. ~9% bleed at 0.1.
    modelPreferences: [
      {
        provider: "synthetic",
        model: "hf:zai-org/GLM-5.2",
        thinking: "low",
        weight: 1,
      },
      {
        provider: "neuralwatt",
        model: "glm-5.2",
        thinking: "low",
        weight: 0.1,
      },
    ],
  });

  subagent.register();
}
