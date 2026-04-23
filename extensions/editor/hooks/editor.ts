import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT,
  AD_EDITOR_DRAFT_CHANGED_EVENT,
  AD_EDITOR_READY_EVENT,
  AD_EDITOR_STASH_CHANGED_EVENT,
  type AdEditorBorderDecorationChangedEvent,
  type BorderBand,
  type BorderSlot,
  type EditorBorderWrite,
  type ModeColor,
} from "../../../packages/events";
import {
  BorderEditor,
  type ResolvedBorderDecorations,
  type SlotState,
} from "../components/editor";
import { stashCount } from "../lib/stash";

type SourceState = {
  seq: number;
  writes: EditorBorderWrite[];
};

let activeEditor: ReturnType<typeof createEditorRuntime> | undefined;

const STASH_WIDGET_ID = "editor:stash";

type BorderScroll = {
  top?: number;
  bottom?: number;
};

function updateStashWidget(ctx: ExtensionContext, scroll: BorderScroll): void {
  const count = stashCount();
  const hasOverflow = (scroll.top ?? 0) > 0 || (scroll.bottom ?? 0) > 0;

  const text =
    count > 0
      ? "ctrl+shift+r to unstash"
      : hasOverflow
        ? "ctrl+shift+s to stash"
        : undefined;

  if (!text) {
    ctx.ui.setWidget(STASH_WIDGET_ID, undefined);
    return;
  }

  ctx.ui.setWidget(
    STASH_WIDGET_ID,
    (_tui, theme) => ({
      render(width: number) {
        const dimmed = theme.fg("dim", text);
        const padding = Math.max(0, width - text.length);
        return [" ".repeat(padding) + dimmed];
      },
      handleInput() {},
      invalidate() {},
    }),
    { placement: "aboveEditor" },
  );
}

export function createEditorRuntime(pi: ExtensionAPI) {
  let editorRef: BorderEditor | undefined;
  const sourceStates = new Map<string, SourceState>();
  let sequence = 0;
  let lastScrollTop: number | undefined;
  let lastScrollBottom: number | undefined;

  const resolveDecorations = (): ResolvedBorderDecorations => {
    const entries = [...sourceStates.values()].sort((a, b) => a.seq - b.seq);

    const slots: Partial<Record<BorderSlot, SlotState>> = {};
    const bands: Partial<Record<BorderBand, { color: ModeColor }>> = {};

    for (const entry of entries) {
      for (const write of entry.writes) {
        if (write.kind === "slot") {
          slots[write.slot] = {
            text: write.text,
            color: write.color,
          };
          continue;
        }

        bands[write.band] = { color: write.color };
      }
    }

    return {
      slots,
      bands: {
        top: bands.top?.color,
        bottom: bands.bottom?.color,
      },
    };
  };

  const emitScrollWrites = (top?: number, bottom?: number) => {
    if (top === lastScrollTop && bottom === lastScrollBottom) {
      return;
    }

    lastScrollTop = top;
    lastScrollBottom = bottom;

    const writes: EditorBorderWrite[] = [];

    if (typeof top === "number") {
      writes.push({
        kind: "slot",
        slot: "top-end",
        text: `↑ ${top} more ───`,
      });
    }

    if (typeof bottom === "number") {
      writes.push({
        kind: "slot",
        slot: "bottom-end",
        text: `↓ ${bottom} more ───`,
      });
    }

    pi.events.emit(AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT, {
      source: "editor:scroll",
      writes,
    } satisfies AdEditorBorderDecorationChangedEvent);
  };

  pi.events.on(AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT, (data: unknown) => {
    const event = (data ?? {}) as Partial<AdEditorBorderDecorationChangedEvent>;
    if (typeof event.source !== "string" || !Array.isArray(event.writes)) {
      return;
    }

    sourceStates.set(event.source, {
      seq: ++sequence,
      writes: event.writes,
    });

    editorRef?.requestRenderNow();
  });

  // Re-render editor when stash state changes (e.g. after shortcut).
  // This triggers onScrollIndicators which calls updateStashWidget.
  pi.events.on(AD_EDITOR_STASH_CHANGED_EVENT, () => {
    editorRef?.requestRenderNow();
  });

  return {
    setup: (ctx: ExtensionContext) => {
      if (!ctx.hasUI) {
        return;
      }

      ctx.ui.setEditorComponent((tui, theme, keybindings) => {
        const editor = new BorderEditor(tui, theme, keybindings);
        editor.appTheme = ctx.ui.theme;
        editor.getDecorations = resolveDecorations;
        editor.onDraftChanged = (text: string) => {
          pi.events.emit(AD_EDITOR_DRAFT_CHANGED_EVENT, { text });
        };
        editor.onScrollIndicators = (scroll) => {
          // Only act if this editor is still the active instance.
          // After session_shutdown, cleanup() nulls editorRef — callbacks
          // from the old TUI component must become no-ops.
          if (editorRef !== editor) return;
          emitScrollWrites(scroll.top, scroll.bottom);
          updateStashWidget(ctx, scroll);
        };

        editorRef = editor;
        pi.events.emit(AD_EDITOR_READY_EVENT, {});
        pi.events.emit(AD_EDITOR_DRAFT_CHANGED_EVENT, {
          text: editor.getText(),
        });

        return editor;
      });
    },
    cleanup: () => {
      editorRef = undefined;
      sourceStates.clear();
      lastScrollTop = undefined;
      lastScrollBottom = undefined;
      sequence = 0;
    },
  };
}

export function setupEditorHook(pi: ExtensionAPI) {
  const runtime = createEditorRuntime(pi);
  activeEditor = runtime;

  pi.on("session_start", async (_event, ctx) => {
    _event.reason;
    runtime.setup(ctx);
  });

  pi.on("session_shutdown", async () => {
    runtime.cleanup();
  });
}

export function restoreDefaultEditor(ctx: ExtensionContext): void {
  if (!ctx.hasUI) {
    return;
  }

  activeEditor?.setup(ctx);
}
