export const SESSION_TITLE_SYSTEM_PROMPT = `You name Pi coding-agent sessions.

You must call the set_title tool exactly once with a concise title for the provided exchange.
Do not produce normal assistant text.

Title rules:
- 4-7 words when possible.
- Be specific to the user's task.
- No quotes.
- No markdown.
- No trailing punctuation.`;

export interface SessionTitleTurn {
  userMessage: string;
  assistantResponse: string;
}

export function buildPrompt(params: { turns: SessionTitleTurn[] }): string {
  return params.turns
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
