import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SubagentPromptResult } from "@harness/agent-kit/types";
import { knownModelFamily, type ModelIdentity } from "@harness/models";
import { assertNever } from "@harness/utils";
import type { ReadSessionParamsType } from "./types";

export const SYSTEM_PROMPT = `You are a session analyzer. Your task is to extract specific information from a Pi coding agent session.

You have access to session-query tools (get_session_overview, get_branch_entries, get_entries_between, read_entry, get_checkpoints, read_checkpoint, find_entries, get_labels, get_tree_outline). These are the only tools available. Do not invent or call any other tool.

Guidelines:
1. Always start with \`get_session_overview\`.
2. If the overview reports compactions, call \`get_checkpoints\` before broad branch or tree reads. Treat compactions as checkpoints and use them to choose a narrower range.
3. Prefer the main branch. The main branch is the branch whose leaf is the last entry in the session file. Use full-tree tools only when the goal asks about alternate branches or anywhere in the session.
4. Avoid large reads. Use compact tools to identify entry ids, then call \`read_entry\` or \`read_checkpoint\` only for entries needed to answer.
5. For latest/current questions, call \`get_branch_entries\` with \`fromEnd: true\`, a small \`limit\`, and filters when useful.
6. For historical questions in long sessions, inspect checkpoint summaries first, then use \`get_entries_between\`, \`find_entries\`, or small branch windows around relevant checkpoint ids.
7. Treat aborted assistant messages as incomplete. Skip them unless the user specifically asks about aborted work, failures, interruptions, or the exact last raw entry.
8. When looking for the latest meaningful answer, prefer the latest non-aborted assistant message or user message relevant to the goal.
9. For keyword-based goals, use \`find_entries\` first unless checkpoints are likely to answer faster.
10. Use \`get_labels\` when labels/checkpoints are relevant.
11. Avoid \`get_tree_outline\` for large sessions unless branch structure matters. If you use it, set a small \`limit\` and \`maxDepth\`.
12. Respond in markdown with a brief header: session name if available, working directory, and date.
13. For every requested fact, cite the relevant entry or checkpoint. Distinguish direct session evidence from any inference.
14. If the session cannot establish a requested fact, say "not found". Do not infer intent or outcomes from unrelated turns.
15. Be specific and concise. Quote only relevant snippets.`;

export function buildPrompt(
  params: ReadSessionParamsType,
  _ctx: ExtensionContext,
  model: ModelIdentity,
): SubagentPromptResult {
  const family = knownModelFamily(model);

  switch (family) {
    case "glm-4.7-flash":
      return { text: buildFlashReadSessionPrompt(params) };
    case "glm-5.2":
      return { text: buildGlmReadSessionPrompt(params) };
    case "gpt-5.5":
    case "gpt-5.6":
    case "gpt-5.6-sol":
    case "gpt-5.6-terra":
    case "gpt-5.6-luna":
    case "kimi-k2.7-code":
    case undefined:
      return { text: buildGenericReadSessionPrompt(params) };
    default:
      return assertNever(family);
  }
}

export function buildFlashReadSessionPrompt(
  params: ReadSessionParamsType,
): string {
  return [
    `Treat this as a bounded session-evidence extraction. Answer only the stated goal. For every requested field, cite session evidence; return "not found" when the session cannot establish it, and do not infer it from unrelated turns.`,
    "",
    ...inputLines(params),
  ].join("\n");
}

export function buildGlmReadSessionPrompt(
  params: ReadSessionParamsType,
): string {
  return [
    `Treat this as a bounded session research task. Retrieve only the evidence needed for the stated goal, distinguish direct evidence from inference, and stop once the requested extraction is complete.`,
    "",
    ...inputLines(params),
  ].join("\n");
}

export function buildGenericReadSessionPrompt(
  params: ReadSessionParamsType,
): string {
  return inputLines(params).join("\n");
}

function inputLines(params: ReadSessionParamsType): string[] {
  return [
    `<target_session_id>${params.targetSessionId}</target_session_id>`,
    `<goal>${params.goal}</goal>`,
  ];
}
