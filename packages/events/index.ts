export const AD_NOTIFY_DANGEROUS_EVENT = "ad:notify:dangerous";
export const AD_NOTIFY_ATTENTION_EVENT = "ad:notify:attention";
export const AD_NOTIFY_DONE_EVENT = "ad:notify:done";

export const AD_TERMINAL_TITLE_ATTENTION_EVENT = "ad:terminal-title:attention";

export const AD_MODEL_FAST_MODE_CHANGED_EVENT = "ad:model-fast-mode:changed";

export type AdModelFastModeChangedEvent = {
  provider: string;
  enabled: boolean;
};
