import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent, loadAgentsFilesFromCwd } from "@harness/agent-kit";
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
      "Zero-shot local codebase researcher. Give a scoped query, local cwd/root, relevant symbols/paths, and ask for cited evidence.",
    promptSnippet:
      "Local codebase researcher for scoped code search, architecture tracing, and local git history analysis.",
    promptGuidelines: [
      "scout: Use for local codebase understanding, code search, architecture tracing, and local git history analysis.",
      "scout: Use when the repository or workspace is already available on disk; pass cwd when the target root differs from the current working directory.",
      "scout: Do not use for remote GitHub repositories, web research, simple known-file reads, or exact string searches.",
      "scout: Make the query self-contained: include the exact feature/symbol/behavior, local root, relevant paths/errors, what you know, what to ignore, and desired answer shape.",
      "scout: Ask for file and line-range evidence; for architecture questions, ask for a compact map of modules, responsibilities, call paths, constraints, and verified gaps.",
    ],
    systemPrompt: SCOUT_SYSTEM_PROMPT,
    parameters: ScoutParams,
    resumable: true,
    renderHeader: renderScoutHeader,
    renderDetails: renderScoutDetails,
    buildPrompt,
    resolveAgentsFiles: (params, ctx) =>
      loadAgentsFilesFromCwd(path.resolve(ctx.cwd, params.cwd?.trim() || ".")),
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
        // Cheap trial primary: demote if quality lags GLM-5.2. Served without
        // thinking (neuralwatt registers reasoning: false).
        provider: "neuralwatt",
        model: "gemma-4-31b",
        thinking: "off",
        weight: 2,
      },
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
