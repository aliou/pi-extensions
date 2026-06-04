/**
 * Helper functions for the spawn command.
 */

import type { SessionEntry } from "@earendil-works/pi-coding-agent";

/**
 * Extract plain text from a message content array or string.
 */
export function messageContentToText(
  content: string | Array<{ type: string; text?: string }>,
): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n");
}

/**
 * Get the text of the last assistant message from a branch's entries.
 */
export function getLastAssistantTextFromEntries(
  entries: SessionEntry[],
): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type !== "message") continue;

    const msg = entry.message;
    if (msg.role !== "assistant") continue;

    const text = messageContentToText(msg.content).trim();
    if (text) return text;
  }
  return undefined;
}

/**
 * Build the content for the source entry in the child session.
 */
export function buildSpawnSourceContent(params: {
  parentSessionId: string;
  parentLastMessage?: string;
}): string {
  const { parentSessionId, parentLastMessage } = params;

  if (parentLastMessage) {
    return `Session spawned from ${parentSessionId}.

## Last message in parent session

${parentLastMessage}`;
  }

  return `Session spawned from ${parentSessionId}.`;
}
