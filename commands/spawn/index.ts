/**
 * Spawn command - /spawn [note]
 *
 * Creates a new child session linked to the current one. The interactive UI
 * chooses whether to carry no context, the last assistant message, or an
 * edited version of the last assistant message into the child.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
} from "@harness/events";
import { ExternalEditorComponent } from "@harness/ui";
import {
  buildSpawnSourceContent,
  getLastAssistantTextFromEntries,
} from "./helpers";
import { renderMarker, renderSource } from "./renderers";
import {
  SESSION_LINK_MARKER_TYPE,
  SESSION_LINK_SOURCE_TYPE,
  type SessionContextStrategy,
  type SessionLinkMarkerDetails,
  type SessionLinkSourceDetails,
} from "./types";
import { type SpawnMode, SpawnModePicker } from "./ui";

export type { SessionLinkMarkerDetails, SessionLinkSourceDetails };
export { SESSION_LINK_MARKER_TYPE, SESSION_LINK_SOURCE_TYPE };

export default async function (pi: ExtensionAPI) {
  pi.registerMessageRenderer(SESSION_LINK_MARKER_TYPE, renderMarker);
  pi.registerMessageRenderer(SESSION_LINK_SOURCE_TYPE, renderSource);

  pi.registerCommand("spawn", {
    description: "Create a new child session linked to the current one",
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

      const parentBranch = ctx.sessionManager.getBranch(parentLeafId);
      const lastAssistantText = getLastAssistantTextFromEntries(parentBranch);

      const selection = await chooseSpawnSelection(ctx, lastAssistantText);
      if (selection.status === "cancelled") {
        ctx.ui.notify("Session creation cancelled", "info");
        return;
      }
      if (selection.status === "editor-error") {
        ctx.ui.notify(
          "Editor exited with error. Session creation cancelled",
          "warning",
        );
        return;
      }

      const { contextStrategy, parentLastMessage } = selection;

      const result = await ctx.newSession({
        parentSession: currentSessionFile,
        setup: async (sm) => {
          const parentFile = sm.getHeader()?.parentSession;
          if (parentFile) {
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
                contextStrategy,
              },
            );
          }

          const sourceContent = buildSpawnSourceContent({
            parentSessionId,
            parentLastMessage,
          });

          sm.appendCustomMessageEntry<SessionLinkSourceDetails>(
            SESSION_LINK_SOURCE_TYPE,
            sourceContent,
            true,
            {
              parentSessionFile: parentFile ?? "",
              goal: note,
              linkType: "continue",
              contextStrategy,
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
      }
    },
  });

  const off = pi.events.on(AD_HEADER_COLLECT_EVENT, () => {
    off();
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "spawn",
      description: "new linked session",
    });
  });
}

type SpawnSelectionResult =
  | {
      status: "selected";
      contextStrategy: SessionContextStrategy;
      parentLastMessage?: string;
    }
  | { status: "cancelled" }
  | { status: "editor-error" };

async function chooseSpawnSelection(
  ctx: ExtensionCommandContext,
  lastAssistantText: string | undefined,
): Promise<SpawnSelectionResult> {
  const hasLastMessage = !!lastAssistantText;
  const selectedMode = await ctx.ui.custom<SpawnMode | null>(
    (_tui, theme, _keybindings, done) =>
      new SpawnModePicker(theme, done, () => done(null), hasLastMessage),
  );

  if (!selectedMode) return { status: "cancelled" };

  if (selectedMode === "blank") {
    return { status: "selected", contextStrategy: "none" };
  }

  if (selectedMode === "last") {
    return {
      status: "selected",
      contextStrategy: "last-assistant",
      parentLastMessage: lastAssistantText,
    };
  }

  if (!lastAssistantText) return { status: "cancelled" };

  const edited = await editText(ctx, lastAssistantText);
  if (edited === null) return { status: "editor-error" };

  return {
    status: "selected",
    contextStrategy: "last-assistant",
    parentLastMessage: edited.trim() ? edited : undefined,
  };
}

async function editText(
  ctx: ExtensionCommandContext,
  initialText: string,
): Promise<string | null> {
  const dir = mkdtempSync(join(tmpdir(), "pi-spawn-"));
  const file = join(dir, "context.md");
  writeFileSync(file, initialText, "utf-8");

  try {
    const exitCode = await ctx.ui.custom(ExternalEditorComponent.create(file));

    if (exitCode !== 0) return null;
    return readFileSync(file, "utf-8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
