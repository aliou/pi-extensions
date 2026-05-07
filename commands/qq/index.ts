import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  clearQqWidget,
  showLoadingWidget,
  showResultWidget,
} from "./components/widget";
import { buildQqPrompt } from "./prompt";
import { runQqSubagent } from "./subagent";

export default async function (pi: ExtensionAPI): Promise<void> {
  pi.registerCommand("qq", {
    description: "Ask a quick question without interrupting the agent",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/qq requires interactive mode", "error");
        return;
      }

      if (!ctx.model) {
        ctx.ui.notify("No model selected", "error");
        return;
      }

      const question = args?.trim();
      if (!question) {
        ctx.ui.notify("Usage: /qq <question>", "warning");
        return;
      }

      const { userMessage, systemPrompt } = buildQqPrompt(ctx, question);
      const model = ctx.model;

      showLoadingWidget(ctx, question);

      try {
        const answer = await runQqSubagent(pi, ctx, systemPrompt, userMessage);

        clearQqWidget(ctx);
        if (!answer) {
          ctx.ui.notify("No response generated", "warning");
          return;
        }

        showResultWidget(ctx, question, answer, model);
      } catch (err) {
        clearQqWidget(ctx);
        ctx.ui.notify(
          `qq error: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    },
  });

  pi.on("agent_start", async (_event, ctx) => {
    clearQqWidget(ctx);
  });
}
