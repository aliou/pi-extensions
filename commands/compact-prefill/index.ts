import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
} from "@harness/events";

export default async function (pi: ExtensionAPI) {
  pi.registerCommand("compact:prefill", {
    description: "Trigger compaction and prefill the editor with the arguments",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("compact requires interactive mode", "error");
        return;
      }

      const text = args.trim();

      ctx.compact({
        onComplete: () => {
          ctx.ui.notify("Compaction completed", "info");
        },
        onError: (error) => {
          ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
        },
      });

      if (text) {
        ctx.ui.setEditorText(text);
      }
    },
  });

  const off = pi.events.on(AD_HEADER_COLLECT_EVENT, () => {
    off();
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "compact:prefill",
      description: "compact and prefill editor",
    });
  });
}
