import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  AD_HEADER_REGISTER_LOGO_EVENT,
  AD_HEADER_REGISTER_SHORTCUT_EVENT,
  type AdHeaderRegisterCommandEvent,
  type AdHeaderRegisterShortcutEvent,
} from "@harness/events";
import { createCustomHeader, type HeaderData } from "../components/header";

export function setupHeaderHook(pi: ExtensionAPI) {
  const header = createCustomHeader();

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const commands: AdHeaderRegisterCommandEvent[] = [];
    const shortcuts: AdHeaderRegisterShortcutEvent[] = [];
    let logo = "pi";

    const seenCmds = new Set<string>();
    const offCmd = pi.events.on(AD_HEADER_REGISTER_COMMAND_EVENT, (data) => {
      if (data && typeof data === "object") {
        const d = data as AdHeaderRegisterCommandEvent;
        if (!seenCmds.has(d.name)) {
          seenCmds.add(d.name);
          commands.push(d);
        }
      }
    });

    const seenShcs = new Set<string>();
    const offShc = pi.events.on(AD_HEADER_REGISTER_SHORTCUT_EVENT, (data) => {
      if (data && typeof data === "object") {
        const d = data as AdHeaderRegisterShortcutEvent;
        if (!seenShcs.has(d.key)) {
          seenShcs.add(d.key);
          shortcuts.push(d);
        }
      }
    });

    const offLogo = pi.events.on(AD_HEADER_REGISTER_LOGO_EVENT, (data) => {
      if (typeof data === "string") logo = data;
    });

    // Ask every loaded extension to announce its header items.
    // Node.js EventEmitter runs listeners synchronously, so by
    // the time emit() returns the arrays above are fully populated.
    pi.events.emit(AD_HEADER_COLLECT_EVENT, undefined);

    offCmd();
    offShc();
    offLogo();

    const data: HeaderData = { logo, commands, shortcuts };
    header.setup(ctx, data);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    header.cleanup(ctx);
  });
}
