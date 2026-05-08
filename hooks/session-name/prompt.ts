import type { SessionNameTurn } from "./types";

export const SESSION_NAME_SYSTEM_PROMPT = `You name Pi coding-agent sessions.

You must call the set_name tool exactly once with a concise name for the provided exchange.
Do not produce normal assistant text.

Name rules:
- 4-7 words when possible.
- Be specific to the user's task.
- No quotes.
- No markdown.
- No trailing punctuation.

If a current name is provided, review it against the recent turns. Call set_name with the same name if it still fits, or with an improved name if the conversation has shifted.`;

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
