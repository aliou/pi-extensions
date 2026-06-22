import type {
  AgentMessage,
  CompactionPreparation,
  ThinkingLevel,
} from "@earendil-works/pi-agent-core";
import {
  type Api,
  completeSimple,
  type Message,
  type Model,
  type ThinkingLevel as PiAiThinkingLevel,
} from "@earendil-works/pi-ai";
import type { CompactionResult } from "@earendil-works/pi-coding-agent";
import {
  convertToLlm,
  generateSummary,
  serializeConversation,
} from "@earendil-works/pi-coding-agent";

import {
  SUMMARIZATION_SYSTEM_PROMPT,
  TURN_PREFIX_SUMMARIZATION_PROMPT,
} from "./prompts";
import { computeFileLists, formatFileOperations } from "./utils";

async function generateTurnPrefixSummary(
  messages: AgentMessage[],
  model: Model<Api>,
  reserveTokens: number,
  apiKey: string | undefined,
  headers: Record<string, string> | undefined,
  env: Record<string, string> | undefined,
  signal: AbortSignal | undefined,
  thinkingLevel: ThinkingLevel | undefined,
): Promise<string> {
  const maxTokens = Math.min(
    Math.floor(0.5 * reserveTokens),
    model.maxTokens > 0 ? model.maxTokens : Number.POSITIVE_INFINITY,
  );
  const llmMessages = convertToLlm(messages);
  const conversationText = serializeConversation(llmMessages);
  const promptText = `<conversation>\n${conversationText}\n</conversation>\n\n${TURN_PREFIX_SUMMARIZATION_PROMPT}`;
  const summarizationMessages: Message[] = [
    {
      role: "user",
      content: [{ type: "text", text: promptText }],
      timestamp: Date.now(),
    },
  ];

  const response = await completeSimple(
    model,
    {
      systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
      messages: summarizationMessages,
    },
    {
      maxTokens,
      apiKey,
      headers,
      env,
      signal,
      reasoning:
        thinkingLevel === "off"
          ? undefined
          : (thinkingLevel as PiAiThinkingLevel),
    },
  );

  if (response.stopReason === "error") {
    throw new Error(
      `Turn prefix summarization failed: ${response.errorMessage || "Unknown error"}`,
    );
  }

  return response.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

/**
 * Compaction that behaves like the native implementation, but runs the two
 * summarization calls sequentially instead of concurrently.
 */
export async function compact(
  preparation: CompactionPreparation,
  model: Model<Api>,
  apiKey: string | undefined,
  headers: Record<string, string> | undefined,
  env: Record<string, string> | undefined,
  customInstructions: string | undefined,
  signal: AbortSignal,
  thinkingLevel: ThinkingLevel | undefined,
): Promise<CompactionResult> {
  const {
    firstKeptEntryId,
    messagesToSummarize,
    turnPrefixMessages,
    isSplitTurn,
    tokensBefore,
    previousSummary,
    fileOps,
    settings,
  } = preparation;

  let summary: string;

  if (isSplitTurn && turnPrefixMessages.length > 0) {
    const historyResult =
      messagesToSummarize.length > 0
        ? await generateSummary(
            messagesToSummarize,
            model,
            settings.reserveTokens,
            apiKey,
            headers,
            signal,
            customInstructions,
            previousSummary,
            thinkingLevel,
            undefined,
            env,
          )
        : "No prior history.";

    const turnPrefixResult = await generateTurnPrefixSummary(
      turnPrefixMessages,
      model,
      settings.reserveTokens,
      apiKey,
      headers,
      env,
      signal,
      thinkingLevel,
    );

    summary = `${historyResult}\n\n---\n\n**Turn Context (split turn):**\n\n${turnPrefixResult}`;
  } else {
    summary = await generateSummary(
      messagesToSummarize,
      model,
      settings.reserveTokens,
      apiKey,
      headers,
      signal,
      customInstructions,
      previousSummary,
      thinkingLevel,
      undefined,
      env,
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
