import type {
  ExtensionAPI,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  AD_HEADER_REGISTER_COMPLETION_EVENT,
  AD_HEADER_REGISTER_LOGO_EVENT,
  AD_HEADER_REGISTER_SHORTCUT_EVENT,
  AD_WORKSPACE_METADATA_CAPTURED_EVENT,
  type AdHeaderRegisterCommandEvent,
  type AdHeaderRegisterCompletionEvent,
  type AdHeaderRegisterShortcutEvent,
  WORKSPACE_METADATA_CUSTOM_TYPE,
  type WorkspaceMetadata,
} from "@harness/events";
import { createCustomHeader, type HeaderData } from "../components/header";

export function findLatestWorkspaceMetadata(
  entries: readonly SessionEntry[],
): WorkspaceMetadata | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (
      entry?.type === "custom" &&
      entry.customType === WORKSPACE_METADATA_CUSTOM_TYPE
    ) {
      return entry.data as WorkspaceMetadata;
    }
  }
  return undefined;
}

export function setupHeaderHook(pi: ExtensionAPI) {
  const header = createCustomHeader();
  let offWorkspaceMetadata: (() => void) | undefined;

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    offWorkspaceMetadata?.();

    const commands: AdHeaderRegisterCommandEvent[] = [];
    const shortcuts: AdHeaderRegisterShortcutEvent[] = [];
    const completions: AdHeaderRegisterCompletionEvent[] = [];
    let logo = "pi";
    let logoRegistered = false;

    const seenCmds = new Set<string>();
    const offCmd = pi.events.on(AD_HEADER_REGISTER_COMMAND_EVENT, (data) => {
      const d = data as AdHeaderRegisterCommandEvent;
      if (!seenCmds.has(d.name)) {
        seenCmds.add(d.name);
        commands.push(d);
      }
    });

    const seenShcs = new Set<string>();
    const offShc = pi.events.on(AD_HEADER_REGISTER_SHORTCUT_EVENT, (data) => {
      const d = data as AdHeaderRegisterShortcutEvent;
      if (!seenShcs.has(d.key)) {
        seenShcs.add(d.key);
        shortcuts.push(d);
      }
    });

    const seenCompletions = new Set<string>();
    const offCompletion = pi.events.on(
      AD_HEADER_REGISTER_COMPLETION_EVENT,
      (data) => {
        const d = data as AdHeaderRegisterCompletionEvent;
        if (!seenCompletions.has(d.trigger)) {
          seenCompletions.add(d.trigger);
          completions.push(d);
        }
      },
    );

    const offLogo = pi.events.on(AD_HEADER_REGISTER_LOGO_EVENT, (data) => {
      if (typeof data === "string") {
        logo = data;
        logoRegistered = true;
      }
    });

    // Ask every loaded extension to announce its header items.
    // Node.js EventEmitter runs listeners synchronously, so by
    // the time emit() returns the arrays above are fully populated.
    pi.events.emit(AD_HEADER_COLLECT_EVENT, undefined);

    offCmd();
    offShc();
    offCompletion();
    offLogo();

    const data: HeaderData = {
      logo,
      logoRegistered,
      commands,
      shortcuts,
      completions,
    };
    data.workspaceMetadata = findLatestWorkspaceMetadata(
      ctx.sessionManager.getEntries(),
    );
    header.setup(ctx, data);

    offWorkspaceMetadata = pi.events.on(
      AD_WORKSPACE_METADATA_CAPTURED_EVENT,
      (data) => {
        header.setWorkspaceMetadata(data as WorkspaceMetadata);
      },
    );
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    offWorkspaceMetadata?.();
    offWorkspaceMetadata = undefined;
    header.cleanup(ctx);
  });
}
