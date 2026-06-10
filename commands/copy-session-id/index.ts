import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { copyToClipboard } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  once,
} from "@harness/events";

export default async function (pi: ExtensionAPI) {
  pi.registerCommand("copy:session-id", {
    description: "Copy the current session ID to clipboard",
    handler: async (_args, ctx) => {
      const sessionId = ctx.sessionManager.getSessionId();

      if (!sessionId) {
        ctx.ui.notify("No session ID (ephemeral session)", "warning");
        return;
      }

      copyToClipboard(sessionId);
      ctx.ui.notify(sessionId, "info");
    },
  });

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "copy:session-[id/path]",
      description: "copy session ID or path",
    });
  });
}
