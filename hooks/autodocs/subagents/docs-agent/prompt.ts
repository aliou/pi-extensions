/**
 * System + mode-aware invocation prompts for the docs subagent.
 *
 * The system prompt is generic: it describes what the agent is and how it
 * judges docs, but not the tools it has (agent-kit injects those), not the
 * output format (a required custom tool handles that), and not the mode
 * (buildPrompt carries mode-specific instructions).
 */

import type { SubagentPromptResult } from "@harness/agent-kit/types";
import type { DocsAgentParamsType } from "./types";

export const DOCS_AGENT_SYSTEM_PROMPT = `You are the autodocs agent — a documentation-keeping subagent that runs locally inside a Pi coding session.

You keep a project's docs/ directory accurate with respect to the codebase and the work that just happened.

Operating principles:
- Ground every claim in the actual codebase and (when given) the parent session. Verify before asserting.
- Treat docs as a living index of the project: architecture, commands, tools, hooks, packages, conventions, and workflows. Not a code dump.
- Prefer updating existing pages over creating new ones. Archive obsolete pages into the archive/ subdirectory of the docs path rather than deleting them.
- Cross-link related docs. Keep naming and structure consistent with the organizing-docs skill.
- Never invent paths. Build repo-relative paths from the working directory. Do not use placeholder roots like /workspace or /repo.
- Be concrete: name the files, the sections, and the change. A vague brief is a failed brief.`;

export function buildPrompt(params: DocsAgentParamsType): SubagentPromptResult {
  if (params.mode === "apply") return buildApplyPrompt(params);
  return buildCheckPrompt(params);
}

function buildCheckPrompt(params: DocsAgentParamsType): SubagentPromptResult {
  const { docsPath, sessionId, reason, fromSha, toSha } = params;

  const rangePart =
    reason === "drift" && fromSha && toSha
      ? `The default branch advanced from ${fromSha} to ${toSha}. Inspect that range (e.g. git log --stat ${fromSha}..${toSha}) and focus on what materially changed in it.`
      : "No specific range: audit the docs against the current codebase as a whole.";

  const text = `Task: assess whether the docs drifted, and what should change.

Docs directory (repo-relative): ${docsPath}
Parent session id: ${sessionId}

${rangePart}

1. Read the parent session (targetSessionId "${sessionId}") to understand what just happened in the main session.
2. Inspect the current docs at ${docsPath}/. Note what exists and what is stale or missing.
3. Inspect the changed source for this ${reason}.
4. Apply the writing-docs, organizing-docs, and archiving-docs skills for judgment.
5. Call submit_check exactly once with your assessment. Set needsUpdate=false when docs are already accurate.`;

  return { text };
}

function buildApplyPrompt(params: DocsAgentParamsType): SubagentPromptResult {
  const { docsPath, plan } = params;

  const text = `Task: apply the following doc target plan. Create the docs directory if it does not exist.

Docs directory (repo-relative): ${docsPath}

Plan (JSON):
${plan ?? "[]"}

- "create": write a new doc file at the path.
- "update": edit the existing doc file to reflect the change. Preserve its structure; update only what drifted.
- "archive": move the existing doc file to ${docsPath}/archive/<name> (create archive/ if needed).
- Follow the loaded docs skills for voice, structure, cross-linking, diagramming, and archival.
- Do not touch files outside ${docsPath}/.

Return a short plain-English summary of what you changed.`;

  return { text };
}
