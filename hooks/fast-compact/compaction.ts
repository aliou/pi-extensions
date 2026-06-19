import type {
  AgentMessage,
  CompactionPreparation,
} from "@earendil-works/pi-agent-core";
import type { CompactionResult } from "@earendil-works/pi-coding-agent";
import {
  convertToLlm,
  serializeConversation,
} from "@earendil-works/pi-coding-agent";

import {
  SUMMARIZATION_PROMPT,
  TURN_PREFIX_SUMMARIZATION_PROMPT,
  UPDATE_SUMMARIZATION_PROMPT,
} from "./prompts";
import { computeFileLists, formatFileOperations } from "./utils";

async function summarizeHistory(
  messages: AgentMessage[],
  customInstructions: string | undefined,
  previousSummary: string | undefined,
  summarize: (prompt: string) => Promise<string>,
): Promise<string> {
  const basePrompt = previousSummary
    ? UPDATE_SUMMARIZATION_PROMPT
    : SUMMARIZATION_PROMPT;
  const promptWithFocus = customInstructions
    ? `${basePrompt}\n\nAdditional focus: ${customInstructions}`
    : basePrompt;

  const llmMessages = convertToLlm(messages);
  const conversationText = serializeConversation(llmMessages);

  let promptText = `<conversation>\n${conversationText}\n</conversation>\n\n`;
  if (previousSummary) {
    promptText += `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n`;
  }
  promptText += promptWithFocus;

  return summarize(promptText);
}

async function summarizeTurnPrefix(
  messages: AgentMessage[],
  summarize: (prompt: string) => Promise<string>,
): Promise<string> {
  const llmMessages = convertToLlm(messages);
  const conversationText = serializeConversation(llmMessages);
  const promptText = `<conversation>\n${conversationText}\n</conversation>\n\n${TURN_PREFIX_SUMMARIZATION_PROMPT}`;

  return summarize(promptText);
}

export async function fastCompact(
  preparation: CompactionPreparation,
  customInstructions: string | undefined,
  summarize: (prompt: string) => Promise<string>,
): Promise<CompactionResult> {
  const {
    firstKeptEntryId,
    messagesToSummarize,
    turnPrefixMessages,
    isSplitTurn,
    tokensBefore,
    previousSummary,
    fileOps,
  } = preparation;

  let summary: string;

  if (isSplitTurn && turnPrefixMessages.length > 0) {
    const historyResult =
      messagesToSummarize.length > 0
        ? await summarizeHistory(
            messagesToSummarize,
            customInstructions,
            previousSummary,
            summarize,
          )
        : "No prior history.";

    const turnPrefixResult = await summarizeTurnPrefix(
      turnPrefixMessages,
      summarize,
    );

    summary = `${historyResult}\n\n---\n\n**Turn Context (split turn):**\n\n${turnPrefixResult}`;
  } else {
    summary = await summarizeHistory(
      messagesToSummarize,
      customInstructions,
      previousSummary,
      summarize,
    );
  }

  const { readFiles, modifiedFiles } = computeFileLists(fileOps);
  summary += formatFileOperations(readFiles, modifiedFiles);

  if (!firstKeptEntryId) {
    throw new Error(
      "First kept entry has no UUID - session may need migration",
    );
  }

  return {
    summary,
    firstKeptEntryId,
    tokensBefore,
    details: { readFiles, modifiedFiles },
  };
}
