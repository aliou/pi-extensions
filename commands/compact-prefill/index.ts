import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

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
}
