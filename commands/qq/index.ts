import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
  once,
} from "@harness/events";
import { QqList } from "./components/list";
import {
  clearQqWidget,
  showLoadingWidget,
  showResultWidget,
} from "./components/widget";
import { buildQqList } from "./context";
import { buildSideChatContext } from "./format";
import { buildQqPrompt } from "./prompt";
import { renderQqContext } from "./render";
import { runQqSubagent } from "./subagent";
import {
  QQ_ANSWER_TYPE,
  QQ_CONTEXT_TYPE,
  type QqAnswerDetails,
  type QqContextDetails,
} from "./types";

export default async function (pi: ExtensionAPI): Promise<void> {
  pi.registerMessageRenderer<QqContextDetails>(
    QQ_CONTEXT_TYPE,
    renderQqContext,
  );

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
      showLoadingWidget(ctx, question);

      try {
        const details = await runQqSubagent(pi, ctx, systemPrompt, userMessage);

        clearQqWidget(ctx);
        if (!details?.response) {
          ctx.ui.notify("No response generated", "warning");
          return;
        }

        const answerDetails: QqAnswerDetails = {
          id: crypto.randomUUID(),
          question,
          answer: details.response,
          createdAt: Date.now(),
          usage: details.usage,
          model: details.model,
        };

        pi.appendEntry<QqAnswerDetails>(QQ_ANSWER_TYPE, answerDetails);
        showResultWidget(ctx, answerDetails);
      } catch (err) {
        clearQqWidget(ctx);
        ctx.ui.notify(
          `qq error: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    },
  });

  pi.registerCommand("qq:list", {
    description: "List side chat answers and add one to context",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/qq:list requires interactive mode", "error");
        return;
      }

      const items = buildQqList(ctx.sessionManager.getBranch());
      if (items.length === 0) {
        ctx.ui.notify("No side chats in this session", "info");
        return;
      }

      const selected = await ctx.ui.custom<string | null>(
        (_tui, theme, _keybindings, done) =>
          new QqList(items, theme, (item) => done(item?.details.id ?? null)),
      );

      if (!selected) return;

      const item = items.find((candidate) => candidate.details.id === selected);
      if (!item) return;

      if (item.status === "in_context") {
        ctx.ui.notify("Side chat already in context", "info");
        return;
      }

      pi.sendMessage<QqContextDetails>(
        {
          customType: QQ_CONTEXT_TYPE,
          content: buildSideChatContext(item.details),
          display: true,
          details: {
            qqId: item.details.id,
            insertedAt: Date.now(),
            answer: item.details,
          },
        },
        ctx.isIdle()
          ? { triggerTurn: false }
          : { triggerTurn: true, deliverAs: "steer" },
      );
    },
  });

  pi.on("agent_start", async (_event, ctx) => {
    clearQqWidget(ctx);
  });

  once(pi, AD_HEADER_COLLECT_EVENT, () => {
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "qq[:list]",
      description: "quick question / side chat context",
    });
  });
}
