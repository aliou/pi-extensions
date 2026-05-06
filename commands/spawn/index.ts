/**
 * Spawn command - /spawn [note]
 *
 * Creates a new session linked to the current one, without context extraction.
 * Optionally accepts a note describing the focus for the new session.
 *
 * Also registers renderers for session-link-marker and session-link-source
 * custom message types so they display nicely in the TUI.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import {
  buildSpawnSourceContent,
  getLastAssistantTextFromEntries,
} from "./helpers";
import { renderMarker, renderSource } from "./renderers";
import {
  SESSION_LINK_MARKER_TYPE,
  SESSION_LINK_SOURCE_TYPE,
  type SessionLinkMarkerDetails,
  type SessionLinkSourceDetails,
} from "./types";

export type { SessionLinkMarkerDetails, SessionLinkSourceDetails };
export { SESSION_LINK_MARKER_TYPE, SESSION_LINK_SOURCE_TYPE };

export default async function (pi: ExtensionAPI) {
  pi.registerMessageRenderer(SESSION_LINK_MARKER_TYPE, renderMarker);
  pi.registerMessageRenderer(SESSION_LINK_SOURCE_TYPE, renderSource);

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

      if (!parentLeafId) {
        ctx.ui.notify("Failed to get parent session leaf ID", "error");
        return;
      }

      // Extract the last assistant message from the active parent branch
      const parentBranch = ctx.sessionManager.getBranch(parentLeafId);
      const lastAssistantText = getLastAssistantTextFromEntries(parentBranch);

      const result = await ctx.newSession({
        parentSession: currentSessionFile,
        setup: async (sm) => {
          const parentFile = sm.getHeader()?.parentSession;
          if (parentFile) {
            // Write marker entry in parent session
            SessionManager.open(
              parentFile,
            ).appendCustomMessageEntry<SessionLinkMarkerDetails>(
              SESSION_LINK_MARKER_TYPE,
              "",
              true,
              {
                targetSessionFile: sm.getSessionFile() ?? "",
                goal: note,
                linkType: "continue",
              },
            );
          }

          // Write source entry in child session
          const sourceContent = buildSpawnSourceContent({
            parentSessionId,
            parentLastMessage: lastAssistantText,
          });
          sm.appendCustomMessageEntry<SessionLinkSourceDetails>(
            SESSION_LINK_SOURCE_TYPE,
            sourceContent,
            true,
            {
              parentSessionFile: parentFile ?? "",
              goal: note,
              linkType: "continue",
            },
          );
        },
        withSession: async (newCtx) => {
          if (note) {
            newCtx.ui.setEditorText(note);
          }
        },
      });

      if (result.cancelled) {
        ctx.ui.notify("Session creation cancelled", "info");
        return;
      }
    },
  });
}
