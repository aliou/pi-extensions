/**
 * Spawn command - /spawn [note]
 *
 * Creates a new session linked to the current one, without context extraction.
 * Optionally accepts a note describing the focus for the new session.
 */

import type { ExtensionAPI, SessionEntry } from "@mariozechner/pi-coding-agent";
import {
  messageContentToText,
  writeSessionLinkMarker,
  writeSessionLinkSource,
} from "../../lib/session-link";

/**
 * Extract the text of the last assistant message from a branch.
 * Walks backward through entries, finds the last "message" entry
 * with role "assistant", and returns its text content.
 */
function getLastAssistantMessage(entries: SessionEntry[]): string | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type !== "message") continue;

    const msg = entry.message;
    if (msg.role !== "assistant") continue;

    const text = messageContentToText(msg.content).trim();
    if (text) {
      return text;
    }
  }
  return undefined;
}

function buildSpawnSourceContent(params: {
  parentSessionId: string;
  parentLastMessage?: string;
}): string {
  const { parentSessionId, parentLastMessage } = params;

  if (parentLastMessage) {
    return `Session spawned from ${parentSessionId}.

## Last message in parent session

${parentLastMessage}`;
  }

  return `Session spawned from ${parentSessionId}. Use \`read_session\` to access the parent session context:

read_session({ sessionId: "${parentSessionId}", goal: "Get the last assistant message with context" })`;
}

export default async function (pi: ExtensionAPI) {
  pi.registerCommand("spawn", {
    description:
      "Create a new session linked to the current one (no context extraction)",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("spawn requires interactive mode", "error");
        return;
      }

      const note = args.trim() || "";
      const parentSessionId = ctx.sessionManager.getSessionId() ?? "unknown";
      const parentLeafId = ctx.sessionManager.getLeafId();
      const currentSessionFile = ctx.sessionManager.getSessionFile();

      // Extract the last assistant message from the active parent branch
      const parentBranch = ctx.sessionManager.getBranch(
        parentLeafId ?? undefined,
      );
      const lastMessage = getLastAssistantMessage(parentBranch);

      if (!parentLeafId) {
        ctx.ui.notify("Failed to get parent session leaf ID", "error");
        return;
      }

      const result = await ctx.newSession({
        parentSession: currentSessionFile,
        setup: async (sm) => {
          const newSessionId = sm.getSessionId();
          if (currentSessionFile && newSessionId) {
            writeSessionLinkMarker(
              currentSessionFile,
              newSessionId,
              note,
              "continue",
              parentLeafId,
            );
          }
          const sourceContent = buildSpawnSourceContent({
            parentSessionId,
            parentLastMessage: lastMessage,
          });
          writeSessionLinkSource(
            sm,
            parentSessionId,
            note,
            "continue",
            sourceContent,
          );
        },
      });

      if (result.cancelled) {
        ctx.ui.notify("Session creation cancelled", "info");
        return;
      }

      if (note) {
        ctx.ui.setEditorText(note);
      }
    },
  });
}
