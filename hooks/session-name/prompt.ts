import type { SessionNameTurn } from "./types";

export const SESSION_NAME_SYSTEM_PROMPT = `You name Pi coding-agent sessions.

You must call the set_name tool exactly once using its name argument.
Do not produce normal assistant text.

Name rules:
- 4-7 words when possible.
- Be specific to the user's durable task or workstream.
- No quotes.
- No markdown.
- No trailing punctuation.

When no current name is provided, create the best name for the exchange.

When a current name is provided, treat it as the stable session topic and use the recent turns only to decide whether it should be refined. Prefer keeping the current name. Change it only when the new name is a better label for the whole session, not just the latest subtask, question, bug, file, or implementation detail.

Refinement rules:
- Preserve the main project/product/component words from the current name unless they are clearly wrong.
- Do not replace a broad accurate name with a narrow recent-detail name.
- Do not chase every topic shift; rename only after the conversation has clearly moved to a new durable workstream.
- If the recent turns are continuing, debugging, testing, documenting, or implementing the same work, call set_name with the current name.
- If you rename, make the new name connect the stable topic with the new durable focus.`;

export function buildPrompt(params: {
  turns: SessionNameTurn[];
  currentName?: string;
}): string {
  const parts: string[] = [];

  if (params.currentName != null) {
    parts.push(`<current_name>
${params.currentName}
</current_name>`);
  }

  parts.push(formatTurns(params.turns));

  return parts.join("\n\n");
}

function formatTurns(turns: SessionNameTurn[]): string {
  return turns
    .map(
      (turn, index) => `<turn index="${index + 1}">
<user_message>
${turn.userMessage}
</user_message>

<assistant_response>
${turn.assistantResponse}
</assistant_response>
</turn>`,
    )
    .join("\n\n");
}
