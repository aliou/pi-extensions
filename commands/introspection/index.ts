import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";
import {
  IntrospectPanel,
  type IntrospectSnapshot,
} from "./components/introspect-panel";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("introspect", {
    description:
      "Show introspection info: system prompt, tools, skills, prompts",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("introspect requires interactive mode", "error");
        return;
      }

      await ctx.waitForIdle();

      const snapshot = buildSnapshot(pi, ctx);

      await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
        const panel = new IntrospectPanel(tui, theme, snapshot, () =>
          done(null),
        );
        return {
          render: (width: number) => panel.render(width),
          invalidate: () => panel.invalidate(),
          handleInput: (data: string) => panel.handleInput(data),
        };
      });
    },
  });
}

function buildSnapshot(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
): IntrospectSnapshot {
  const commands = pi.getCommands();

  return {
    systemPrompt: ctx.getSystemPrompt(),
    activeTools: pi.getActiveTools(),
    allTools: pi.getAllTools(),
    skills: commands.filter((c) => c.source === "skill"),
    prompts: commands.filter((c) => c.source === "prompt"),
  };
}
