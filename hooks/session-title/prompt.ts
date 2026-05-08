import type { SessionTitleTurn } from "./types";

export const SESSION_TITLE_SYSTEM_PROMPT = `You name Pi coding-agent sessions.

You must call the set_title tool exactly once with a concise title for the provided exchange.
Do not produce normal assistant text.

Title rules:
- 4-7 words when possible.
- Be specific to the user's task.
- No quotes.
- No markdown.
- No trailing punctuation.

If a current title is provided, review it against the recent turns. Call set_title with the same title if it still fits, or with an improved title if the conversation has shifted.`;

export function buildPrompt(params: {
  turns: SessionTitleTurn[];
  currentTitle?: string;
}): string {
  const parts: string[] = [];

  if (params.currentTitle != null) {
    parts.push(`<current_title>
${params.currentTitle}
</current_title>`);
  }

  parts.push(formatTurns(params.turns));

  return parts.join("\n\n");
}

function formatTurns(turns: SessionTitleTurn[]): string {
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
