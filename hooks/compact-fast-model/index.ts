import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  convertToLlm,
  serializeConversation,
} from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import { get } from "@harness/model-registry";
import { Type } from "typebox";
import { pickCompactionModel } from "./model";
import {
  SUMMARIZATION_PROMPT,
  SUMMARIZATION_SYSTEM_PROMPT,
  UPDATE_SUMMARIZATION_PROMPT,
} from "./prompts";
import { createCompactionTools } from "./tools";

export default function compactFastModelHook(pi: ExtensionAPI): void {
  pi.on("session_before_compact", async (event, ctx) => {
    const {
      preparation: {
        messagesToSummarize,
        turnPrefixMessages,
        tokensBefore,
        firstKeptEntryId,
        previousSummary,
      },
      customInstructions,
      signal,
    } = event;

    signal.throwIfAborted();

    const modelSelection = pickCompactionModel(ctx.modelRegistry);
    if (!modelSelection) {
      ctx.ui.notify(
        "compact-fast: No fast model available, falling back to native compaction",
        "warning",
      );
      return undefined;
    }

    const {
      model: { provider, name },
    } = modelSelection;

    ctx.ui.notify(
      `compact-fast: Compacting with ${provider}/${name}...`,
      "info",
    );

    const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
    if (allMessages.length === 0) {
      ctx.ui.notify(
        "compact-fast: No messages to summarize, falling back to native compaction",
        "warning",
      );
      return undefined;
    }

    let summary: string | undefined;

    const subagent = createSubagent(pi, {
      name: "compact_fast_model",
      label: "Fast Compaction",
      description: "Summarize conversation using a small fast model.",
      systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
      tools: createCompactionTools((s) => {
        summary = s;
      }),
      models: get("ad:small:text"),
      parameters: Type.Object({
        conversationText: Type.String(),
        previousSummary: Type.Optional(Type.String()),
        customInstructions: Type.Optional(Type.String()),
      }),
      buildPrompt: (params) => {
        const text = [
          // Conversation text
          `<conversation>\n${params.conversationText}\n</conversation>`,

          // Previous summaries if this is a follow up compaction.
          params.previousSummary &&
            `<previous-summary>\n${params.previousSummary}\n</previous-summary>`,

          // Different prompt if this is a follow up compaction.
          params.previousSummary
            ? UPDATE_SUMMARIZATION_PROMPT
            : SUMMARIZATION_PROMPT,

          // Additional instruction from the user.
          params.customInstructions &&
            `Additional focus: ${params.customInstructions}`,
        ]
          .filter(Boolean)
          .join("\n\n");

        return { text };
      },
    });

    const conversationText = serializeConversation(convertToLlm(allMessages));

    try {
      await subagent.runWithParams(
        { conversationText, previousSummary, customInstructions },
        { callId: "compact-fast-model", signal, ctx },
      );
    } catch (err) {
      if (signal.aborted) return undefined;
      throw err;
    }

    if (!summary) {
      ctx.ui.notify(
        `compact-fast: No summary returned from the model, falling back to native compaction.`,
        "warning",
      );
      return undefined;
    }

    return {
      compaction: {
        summary,
        firstKeptEntryId,
        tokensBefore,
      },
    };
  });
}
