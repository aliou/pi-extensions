import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
} from "@harness/events";

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

  const off = pi.events.on(AD_HEADER_COLLECT_EVENT, () => {
    off();
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "label",
      description: "bookmark current point",
    });
  });
}
