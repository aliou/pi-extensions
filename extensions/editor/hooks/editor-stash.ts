import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { rawKeyHint } from "@mariozechner/pi-coding-agent";
import {
  AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT,
  AD_EDITOR_STASH_CHANGED_EVENT,
  AD_EDITOR_STASH_READY_EVENT,
  AD_EDITOR_STASH_REQUEST_EVENT,
  type AdEditorBorderDecorationChangedEvent,
  type EditorBorderWrite,
} from "../../../packages/events";
import { stashCount, stashPop, stashPush } from "../lib/stash";

const SOURCE = "editor:stash";

function writesForStashCount(count: number): EditorBorderWrite[] {
  const text =
    count > 0
      ? rawKeyHint("ctrl+shift+r", "to unstash")
      : rawKeyHint("ctrl+shift+s", "to stash");
  return [{ kind: "slot", slot: "bottom-start", text }];
}

function emitStashState(pi: ExtensionAPI): void {
  pi.events.emit(AD_EDITOR_STASH_CHANGED_EVENT, {
    count: stashCount(),
  });
}

function publishDecoration(pi: ExtensionAPI): void {
  pi.events.emit(AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT, {
    source: SOURCE,
    writes: writesForStashCount(stashCount()),
  } satisfies AdEditorBorderDecorationChangedEvent);
}

export function setupEditorStashHook(pi: ExtensionAPI) {
  // Respond to stash state requests (e.g. from footer on setup)
  pi.events.on(AD_EDITOR_STASH_REQUEST_EVENT, () => {
    emitStashState(pi);
  });

  // Update border decoration when stash state changes
  pi.events.on(AD_EDITOR_STASH_CHANGED_EVENT, () => {
    publishDecoration(pi);
  });

  // Signal readiness so consumers can request initial state
  pi.events.emit(AD_EDITOR_STASH_READY_EVENT, {});

  // Publish initial decoration once editor is ready
  pi.events.on(AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT, (data: unknown) => {
    const event = (data ?? {}) as Partial<AdEditorBorderDecorationChangedEvent>;
    // Wait for the first decoration from modes to land, then publish ours
    if (event.source === "modes") {
      publishDecoration(pi);
    }
  });

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
