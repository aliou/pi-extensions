import type { AssistantMessage, UserMessage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { isBlank } from "@harness/utils/string";
import { SESSION_NAME_MAX_TURNS } from "./constants";
import type { SessionNameTurn } from "./types";

export function countCompletedAssistantTurns(entries: SessionEntry[]): number {
  let count = 0;

  for (const entry of entries) {
    if (entry.type !== "message") continue;
    if (entry.message.role !== "assistant") continue;
    if (entry.message.stopReason !== "stop") continue;
    count++;
  }

  return count;
}

export function getRecentTurns(entries: SessionEntry[]): SessionNameTurn[] {
  const turns: SessionNameTurn[] = [];
  let currentUserMessage: string | null = null;

  for (const entry of entries) {
    if (entry.type !== "message") continue;

    const message = entry.message;
    if (message.role === "user") {
      currentUserMessage = getUserText(message);
      continue;
    }

    if (message.role !== "assistant") continue;
    if (!currentUserMessage) continue;
    if (message.stopReason !== "stop") continue;

    const assistantResponse = getAssistantText(message as AssistantMessage);
    if (isBlank(assistantResponse)) continue;

    turns.push({
      userMessage: currentUserMessage,
      assistantResponse,
    });
  }

  return turns.slice(-SESSION_NAME_MAX_TURNS);
}

function getUserText(message: UserMessage): string {
  if (typeof message.content === "string") return message.content;

  return message.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("");
}

function getAssistantText(message: AssistantMessage): string {
  return message.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("");
}
