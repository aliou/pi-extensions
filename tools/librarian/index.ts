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
    modelPreferences: [
      {
        provider: "openai-codex",
        model: "gpt-5.3-codex-spark",
        thinking: "off",
        weight: 2,
      },
      {
        provider: "neuralwatt",
        model: "qwen3.6-35b-fast",
        thinking: "off",
        weight: 1,
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
    ],
  });

  subagent.register();
}
