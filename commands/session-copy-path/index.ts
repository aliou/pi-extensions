import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { copyToClipboard } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
} from "@harness/events";

export default async function (pi: ExtensionAPI) {
  pi.registerCommand("session:copy-path", {
    description: "Copy the current session file path to clipboard",
    handler: async (_args, ctx) => {
      const sessionPath = ctx.sessionManager.getSessionFile();

      if (!sessionPath) {
        ctx.ui.notify("No session file (ephemeral session)", "warning");
        return;
      }

      copyToClipboard(sessionPath);
      ctx.ui.notify(sessionPath, "info");
    },
  });

  const off = pi.events.on(AD_HEADER_COLLECT_EVENT, () => {
    off();
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "session:copy-[id/path]",
      description: "copy session ID or path",
    });
  });
}
