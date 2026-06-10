import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Subscribe to an event once. The handler fires at most one time,
 * and the listener is automatically removed before the handler runs.
 */
export function once<T = unknown>(
  pi: ExtensionAPI,
  event: string,
  handler: (data: T) => void,
): void {
  const off = pi.events.on(event, (data: unknown) => {
    off();
    handler(data as T);
  });
}

export const AD_NOTIFY_DANGEROUS_EVENT = "ad:notify:dangerous";
export const AD_NOTIFY_ATTENTION_EVENT = "ad:notify:attention";
export const AD_NOTIFY_DONE_EVENT = "ad:notify:done";

export const AD_TERMINAL_TITLE_ATTENTION_EVENT = "ad:terminal-title:attention";

export const AD_MODEL_FAST_MODE_CHANGED_EVENT = "ad:model-fast-mode:changed";

export type AdModelFastModeChangedEvent = {
  provider: string;
  enabled: boolean;
};

export const AD_EDITOR_STASH_CHANGED_EVENT = "ad:editor-stash:changed";

export type AdEditorStashChangedEvent = {
  hasContent: boolean;
};

export const AD_HEADER_COLLECT_EVENT = "ad:header:collect";
export const AD_HEADER_REGISTER_COMMAND_EVENT = "ad:header:register-command";
export const AD_HEADER_REGISTER_SHORTCUT_EVENT = "ad:header:register-shortcut";
export const AD_HEADER_REGISTER_COMPLETION_EVENT =
  "ad:header:register-completion";
export const AD_HEADER_REGISTER_LOGO_EVENT = "ad:header:register-logo";

export type AdHeaderRegisterCommandEvent = {
  name: string;
  description: string;
};

export type AdHeaderRegisterShortcutEvent = {
  key: string;
  description: string;
};

export type AdHeaderRegisterCompletionEvent = {
  trigger: string;
  description: string;
};
