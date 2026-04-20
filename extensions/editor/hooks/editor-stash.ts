import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  AD_EDITOR_STASH_CHANGED_EVENT,
  AD_EDITOR_STASH_READY_EVENT,
  AD_EDITOR_STASH_REQUEST_EVENT,
} from "../../../packages/events";
import { stashCount, stashPop, stashPush } from "../lib/stash";

function emitStashState(pi: ExtensionAPI): void {
  pi.events.emit(AD_EDITOR_STASH_CHANGED_EVENT, {
    count: stashCount(),
  });
}

export function setupEditorStashHook(pi: ExtensionAPI) {
  // Respond to stash state requests (e.g. from footer on setup)
  pi.events.on(AD_EDITOR_STASH_REQUEST_EVENT, () => {
    emitStashState(pi);
  });

  // Signal readiness so consumers can request initial state
  pi.events.emit(AD_EDITOR_STASH_READY_EVENT, {});

  pi.registerShortcut("ctrl+shift+s", {
    description: "Stash editor content",
    handler: async (ctx) => {
      const text = ctx.ui.getEditorText();
      if (!text) return;
      stashPush(text);
      ctx.ui.setEditorText("");
      emitStashState(pi);
    },
  });

  pi.registerShortcut("ctrl+shift+r", {
    description: "Pop stashed editor content (swaps if editor has content)",
    handler: async (ctx) => {
      const popped = stashPop();
      if (popped === undefined) return;
      const current = ctx.ui.getEditorText();
      if (current) {
        stashPush(current);
      }
      ctx.ui.setEditorText(popped);
      emitStashState(pi);
    },
  });
}
