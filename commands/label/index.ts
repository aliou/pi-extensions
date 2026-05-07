import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  pi.registerCommand("label", {
    description: "Label the current session entry for later navigation",
    handler: async (args, ctx) => {
      const label = args.trim();
      if (!label) {
        ctx.ui.notify("Usage: /label <text>", "warning");
        return;
      }

      const targetId = ctx.sessionManager.getLeafId();
      if (!targetId) {
        ctx.ui.notify("No current session entry to label", "warning");
        return;
      }

      pi.setLabel(targetId, label);
      ctx.ui.notify(`Label added: ${label}`, "info");
    },
  });
}
