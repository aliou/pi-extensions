import {
  AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT,
  AD_EDITOR_DRAFT_CHANGED_EVENT,
  AD_EDITOR_READY_EVENT,
  type AdEditorBorderDecorationChangedEvent,
  type AdEditorDraftChangedEvent,
  type EditorBorderWrite,
} from "@harness/events";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const SOURCE = "editor:shell-indicator";

function isShellDraft(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("!!") || trimmed.startsWith("!");
}

function writesForText(text: string): EditorBorderWrite[] {
  if (!isShellDraft(text)) {
    return [];
  }

  const shellColor = { source: "theme", color: "bashMode" } as const;

  return [
    {
      kind: "slot",
      slot: "top-start",
      text: "$",
    },
    {
      kind: "band",
      band: "top",
      color: shellColor,
    },
    {
      kind: "band",
      band: "bottom",
      color: shellColor,
    },
  ];
}

export function setupShellIndicatorHook(pi: ExtensionAPI) {
  let lastText = "";

  const publish = () => {
    pi.events.emit(AD_EDITOR_BORDER_DECORATION_CHANGED_EVENT, {
      source: SOURCE,
      writes: writesForText(lastText),
    } satisfies AdEditorBorderDecorationChangedEvent);
  };

  pi.events.on(AD_EDITOR_DRAFT_CHANGED_EVENT, (data: unknown) => {
    const event = (data ?? {}) as Partial<AdEditorDraftChangedEvent>;
    if (typeof event.text !== "string") {
      return;
    }

    lastText = event.text;
    publish();
  });

  pi.events.on(AD_EDITOR_READY_EVENT, () => {
    publish();
  });
}
