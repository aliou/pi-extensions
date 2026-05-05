import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { copyToClipboard } from "@mariozechner/pi-coding-agent";

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
}
