export const AD_NOTIFY_DANGEROUS_EVENT = "ad:notify:dangerous";
export const AD_NOTIFY_ATTENTION_EVENT = "ad:notify:attention";
export const AD_NOTIFY_DONE_EVENT = "ad:notify:done";

export const AD_TERMINAL_TITLE_ATTENTION_EVENT = "ad:terminal-title:attention";

export const AD_PALETTE_REGISTER_EVENT = "ad:palette:register";
export const AD_PALETTE_READY_EVENT = "ad:palette:ready";

export const AD_PROVIDERS_CODEX_FAST_MODE_READY_EVENT =
  "ad:providers:codex-fast-mode:ready";
export const AD_PROVIDERS_CODEX_FAST_MODE_REQUEST_EVENT =
  "ad:providers:codex-fast-mode:request";
export const AD_PROVIDERS_CODEX_FAST_MODE_CHANGED_EVENT =
  "ad:providers:codex-fast-mode:changed";

export type AdProvidersCodexFastModeChangedEvent = {
  enabled: boolean;
};

export const AD_PROVIDERS_CODEX_VERBOSITY_READY_EVENT =
  "ad:providers:codex-verbosity:ready";
export const AD_PROVIDERS_CODEX_VERBOSITY_REQUEST_EVENT =
  "ad:providers:codex-verbosity:request";
export const AD_PROVIDERS_CODEX_VERBOSITY_CHANGED_EVENT =
  "ad:providers:codex-verbosity:changed";

export type AdProvidersCodexVerbosityChangedEvent = {
  verbosity?: "low" | "medium" | "high";
};

export const AD_MODES_READY_EVENT = "ad:modes:ready";

export type ModeColor =
  | { source: "theme"; color: string }
  | { source: "raw"; color: string };

export type BorderSlot =
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end";

export type BorderBand = "top" | "bottom";

export type EditorBorderWrite =
  | {
      kind: "slot";
      slot: BorderSlot;
      text: string;
      color?: ModeColor;
    }
  | {
      kind: "band";
      band: BorderBand;
      color: ModeColor;
    };

export type AdEditorBorderDecorationChangedEvent = {
  source: string;
  writes: EditorBorderWrite[];
};

export type AdEditorDraftChangedEvent = {
  text: string;
};

export const AD_EDITOR_STASH_CHANGED_EVENT = "ad:editor:stash-changed";
export const AD_EDITOR_STASH_READY_EVENT = "ad:editor:stash:ready";
export const AD_EDITOR_STASH_REQUEST_EVENT = "ad:editor:stash:request";

export type AdEditorStashChangedEvent = {
  count: number;
};

export const AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT =
  "ad:editor:border-decoration:changed";
export const AD_EDITOR_READY_EVENT = "ad:editor:ready";
export const AD_EDITOR_DRAFT_CHANGED_EVENT = "ad:editor:draft:changed";

export type AdEditorScrollOverflowEvent = {
  top: number;
  bottom: number;
};

export const AD_EDITOR_SCROLL_OVERFLOW_EVENT = "ad:editor:scroll-overflow";
