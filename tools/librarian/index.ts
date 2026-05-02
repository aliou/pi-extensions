import { defineSubagent } from "@harness/agent-kit";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
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
