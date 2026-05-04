export const AD_NOTIFY_DANGEROUS_EVENT = "ad:notify:dangerous";
export const AD_NOTIFY_ATTENTION_EVENT = "ad:notify:attention";
export const AD_NOTIFY_DONE_EVENT = "ad:notify:done";

export const AD_TERMINAL_TITLE_ATTENTION_EVENT = "ad:terminal-title:attention";

export const AD_PROVIDERS_CODEX_FAST_MODE_READY_EVENT =
  "ad:providers:codex-fast-mode:ready";
export const AD_PROVIDERS_CODEX_FAST_MODE_REQUEST_EVENT =
  "ad:providers:codex-fast-mode:request";
export const AD_PROVIDERS_CODEX_FAST_MODE_CHANGED_EVENT =
  "ad:providers:codex-fast-mode:changed";

export type AdProvidersCodexFastModeChangedEvent = {
  enabled: boolean;
};
