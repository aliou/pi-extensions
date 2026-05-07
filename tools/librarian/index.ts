import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineSubagent } from "@harness/agent-kit";
import { MODEL_CANDIDATES } from "./models";
import { buildPrompt, LIBRAIAN_SYSTEM_PROMPT } from "./prompt";
import { createLibrarianGitHubTools } from "./tools";
import { LibrarianParams } from "./types";

export default async function librarian(pi: ExtensionAPI): Promise<void> {
  const tools = createLibrarianGitHubTools(pi);

  const subagent = defineSubagent(pi, {
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
    buildPrompt,
    tools,
    models: MODEL_CANDIDATES,
  });

  subagent.subscribe(pi);

  pi.registerTool(subagent.tool);
  pi.registerTool(subagent.resumeTool);
}
