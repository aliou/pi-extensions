import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import {
  configuredSubagent,
  getSubagentModelPreferences,
} from "@harness/subagent-models";
import { buildPrompt, LIBRAIAN_SYSTEM_PROMPT } from "./prompt";
import { renderLibrarianDetails, renderLibrarianHeader } from "./render";
import { createLibrarianTools } from "./tools";
import { LibrarianParams } from "./types";

export default async function librarian(pi: ExtensionAPI): Promise<void> {
  const tools = createLibrarianTools(pi);

  const subagent = createSubagent(pi, {
    name: "librarian",
    modelPreferences: () => getSubagentModelPreferences("librarian"),
    label: "Librarian",
    description:
      "Zero-shot remote codebase researcher. Give repo names/URLs/orgs, the cross-repo question, branch/version constraints, and ask for cited evidence.",
    promptSnippet:
      "Remote codebase researcher for deep multi-repository analysis, GitHub discovery, and cross-repo architecture tracing.",
    promptGuidelines: [
      "librarian: Use for deep multi-repository, remote GitHub, or cross-codebase analysis; use scout/find/grep for a single local project.",
      "librarian: Make the query self-contained: include repositories/orgs or GitHub URLs, branches/versions, exact feature/symbol/behavior, comparison criteria, what to ignore, and desired output.",
      "librarian: Put prior findings and constraints in context; ask for cited repo paths and line ranges for code-specific claims.",
      "librarian: For architecture questions, ask for a compact map of repos/modules, responsibilities, data flow, constraints, and verified gaps.",
      "librarian: Keep scope narrow. Prefer one cross-repo question per call instead of broad prompts like 'analyze this ecosystem'.",
    ],
    systemPrompt: LIBRAIAN_SYSTEM_PROMPT,
    parameters: LibrarianParams,
    resumable: true,
    renderHeader: renderLibrarianHeader,
    renderDetails: renderLibrarianDetails,
    buildPrompt,
    tools,
  });

  await subagent.ready;
  const { register, notifyOnSessionStart } = configuredSubagent(
    pi,
    "librarian",
    "Librarian",
    subagent,
    subagent.configured,
  );
  register();
  notifyOnSessionStart();
}
