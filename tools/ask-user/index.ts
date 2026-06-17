import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { renderCall, renderResult } from "./render";
import { AskUserQuestionParams } from "./types";
import { runAskUserUI } from "./ui";

const DESCRIPTION = `Gather user input through structured multiple-choice questions.

Present 1-4 questions, each with 2-4 predefined options.
Users can always choose "Other" to provide custom text.
Supports single-select or multi-select mode.

WHEN TO USE:
- Genuine ambiguity where no option is clearly better
- Irreversible actions (destructive changes, publishing, deploying)
- User explicitly asked to be consulted before deciding
- Multiple valid architectural approaches with real trade-offs

WHEN NOT TO USE:
- You can make a reasonable default choice -- just do it
- Low-stakes decisions (formatting, variable names, file organization)
- Yes/no confirmations for routine actions
- Information you could find by reading the codebase or docs

Prefer making a decision and letting the user correct you over asking. Most questions slow the user down more than a wrong guess.`;

const PROMPT_GUIDELINES = [
  "ask_user: Use when there is genuine ambiguity and no option is clearly better.",
  "ask_user: Use for irreversible actions (destructive changes, publishing, deploying).",
  "ask_user: Do not use when you can make a reasonable default choice -- just do it.",
  "ask_user: Do not use for low-stakes decisions or yes/no confirmations for routine actions.",
  "ask_user: Prefer making a decision and letting the user correct you over asking.",
];

export const askUserTool = defineTool({
  name: "ask_user",
  label: "Ask User",
  description: DESCRIPTION,
  parameters: AskUserQuestionParams,
  promptGuidelines: PROMPT_GUIDELINES,

  async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
    if (!ctx.hasUI) {
      return {
        content: [
          {
            type: "text",
            text: "Error: UI not available (running in non-interactive mode)",
          },
        ],
        details: {
          questions: params.questions,
          answers: [],
          error: "UI not available",
        },
      };
    }

    const uiResult = await runAskUserUI(ctx, params);

    if (!uiResult) {
      return {
        content: [{ type: "text", text: "User cancelled" }],
        details: {
          questions: params.questions,
          answers: [],
          error: "cancelled",
        },
      };
    }

    return uiResult;
  },

  renderCall,
  renderResult,
});

export default function (pi: ExtensionAPI): void {
  pi.registerTool(askUserTool);
}
