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
      "Remote codebase-understanding subagent for deep multi-repository analysis.",
    promptGuidelines: [
      "librarian: Use for deep multi-repository or cross-codebase analysis.",
      "librarian: Do not use for simple file or content searches within a single project -- use find/grep instead.",
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
