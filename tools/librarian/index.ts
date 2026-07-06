import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import { buildPrompt, LIBRAIAN_SYSTEM_PROMPT } from "./prompt";
import { renderLibrarianDetails, renderLibrarianHeader } from "./render";
import { createLibrarianTools } from "./tools";
import { LibrarianParams } from "./types";

export default async function librarian(pi: ExtensionAPI): Promise<void> {
  const tools = createLibrarianTools(pi);

  const subagent = createSubagent(pi, {
    name: "librarian",
    label: "Librarian",
    description:
      "Zero-shot remote codebase researcher. Give repo names/URLs/orgs, the cross-repo question, branch/version constraints, and ask for cited evidence.",
    promptSnippet:
      "Remote codebase researcher for deep multi-repository analysis, GitHub discovery, and cross-repo architecture tracing.",
    promptGuidelines: [
      "librarian: Use for deep multi-repository, remote GitHub, or cross-codebase analysis.",
      "librarian: Do not use for simple file or content searches within a single local project -- use find/grep/scout instead.",
      "librarian: GLM-5.2 works well on long-context cross-repo research when scope, constraints, and output evidence are explicit. State the exact repositories/orgs and feature/symbol/behavior to trace.",
      "librarian: Make the query self-contained: include GitHub URLs, branches/versions if relevant, what to compare, what to ignore, and desired output.",
      "librarian: Put prior findings, constraints, and comparison criteria in context; ask for cited repo paths and line ranges for code-specific claims.",
      "librarian: For architecture questions, ask for a compact map of repos/modules, responsibilities, data flow, and verified gaps rather than an open-ended ecosystem summary.",
      "librarian: Keep scope narrow and explicit. Prefer one cross-repo question per call instead of broad prompts like 'analyze this ecosystem'.",
    ],
    systemPrompt: LIBRAIAN_SYSTEM_PROMPT,
    parameters: LibrarianParams,
    resumable: true,
    renderHeader: renderLibrarianHeader,
    renderDetails: renderLibrarianDetails,
    buildPrompt,
    tools,
    // Same model pair as scout: synthetic GLM-5.2 primary, neuralwatt glm-5.2
    // fallback. "low" clamps to "high" on GLM-5.2 (only off/high/xhigh exposed).
    // ~9% bleed at weight 0.1.
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
