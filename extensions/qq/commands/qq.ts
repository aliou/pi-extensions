import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";
import {
  buildSessionContext,
  convertToLlm,
  getMarkdownTheme,
  serializeConversation,
} from "@mariozechner/pi-coding-agent";
import { Loader, Markdown, Text, visibleWidth } from "@mariozechner/pi-tui";
import { executeSubagent } from "../../subagents/lib";
import { QQ_SYSTEM_REMINDER } from "../lib/system-prompt";
import { QQ_MESSAGE_TYPE, type QqDetails, qqPending } from "../lib/types";

const WIDGET_ID = "qq";

/**
 * Wrap content lines in a rounded border with 1-char inner padding.
 */
function wrapInRoundedBorder(
  lines: string[],
  width: number,
  colorFn: (t: string) => string,
): string[] {
  const innerWidth = Math.max(1, width - 2);
  const hBar = "\u2500".repeat(innerWidth);
  const top = colorFn(`\u256D${hBar}\u256E`);
  const bottom = colorFn(`\u2570${hBar}\u256F`);
  const left = colorFn("\u2502");
  const right = colorFn("\u2502");

  const wrapped = lines.map((line) => {
    const contentWidth = visibleWidth(line);
    const fill = Math.max(0, innerWidth - contentWidth);
    return `${left}${line}${" ".repeat(fill)}${right}`;
  });

  return [top, ...wrapped, bottom];
}

/**
 * Show a result widget above the editor while the agent is still working.
 * The widget renders the QQ answer with the same bordered style used by
 * the message renderer, so the visual transition is seamless when the
 * pending state is cleared and the renderer takes over.
 */
function showResultWidget(
  ctx: ExtensionCommandContext,
  question: string,
  answer: string,
  model: { provider: string; id: string },
): void {
  ctx.ui.setWidget(
    WIDGET_ID,
    (_tui, theme) => {
      const borderColor = (t: string) => theme.fg("success", t);
      const mdTheme = getMarkdownTheme();

      return {
        render(width: number) {
          const contentWidth = Math.max(1, width - 4);
          const content: string[] = [];

          // Header line
          content.push(
            theme.fg("customMessageLabel", `\x1b[1mqq:\x1b[22m `) + question,
          );
          content.push("");

          // Answer (first paragraph for brevity in widget)
          const paragraphs = answer.split(/\n\n/).filter((p) => p.trim());
          const firstParagraph = paragraphs[0] ?? "";
          try {
            const md = new Markdown(firstParagraph, 0, 0, mdTheme);
            content.push(...md.render(contentWidth));
          } catch {
            content.push(
              ...new Text(firstParagraph, 0, 0).render(contentWidth),
            );
          }

          // Footer with model info
          content.push("");
          content.push(theme.fg("dim", `(${model.provider}/${model.id})`));

          const padded = content.map((line) => ` ${line} `);
          return wrapInRoundedBorder(padded, width, borderColor);
        },
        handleInput() {},
        invalidate() {},
      };
    },
    { placement: "aboveEditor" },
  );
}

export function registerQqCommand(pi: ExtensionAPI): void {
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

      // Build conversation context
      const entries = ctx.sessionManager.getBranch();
      const sessionContext = buildSessionContext(
        entries,
        ctx.sessionManager.getLeafId(),
      );
      const llmMessages = convertToLlm(sessionContext.messages);

      // Filter out qq messages and in-progress assistant messages
      const filtered = llmMessages.filter((msg) => {
        const maybeCustom = msg as { customType?: unknown };
        if (maybeCustom.customType === QQ_MESSAGE_TYPE) return false;
        if (
          msg.role === "assistant" &&
          (msg.stopReason === undefined || msg.stopReason === null)
        ) {
          return false;
        }
        return true;
      });

      const serialized = serializeConversation(filtered);
      const userMessage = `${serialized}\n\n---\n\nSide question: ${question}`;
      const systemPrompt = ctx.getSystemPrompt() + QQ_SYSTEM_REMINDER;
      const model = ctx.model;

      // Show loading widget with rounded border
      ctx.ui.setWidget(
        WIDGET_ID,
        (tui, theme) => {
          const borderColor = (t: string) => theme.fg("warning", t);
          const loader = new Loader(
            tui,
            (s) => theme.fg("accent", s),
            (s) => theme.fg("muted", s),
            `qq: ${question}`,
          );
          loader.start();

          return {
            render(width: number) {
              const contentWidth = Math.max(1, width - 4);
              const loaderLines = loader.render(contentWidth);
              const padded = loaderLines.map((line) => ` ${line} `);
              return wrapInRoundedBorder(padded, width, borderColor);
            },
            handleInput() {},
            invalidate() {
              loader.invalidate();
            },
            dispose() {
              loader.stop();
            },
          };
        },
        { placement: "aboveEditor" },
      );

      try {
        const result = await executeSubagent(
          {
            name: "qq",
            model,
            systemPrompt,
            tools: [],
            customTools: [],
            thinkingLevel: "off",
            logging: { enabled: true, debug: false },
          },
          userMessage,
          ctx,
        );

        // Clear widget
        ctx.ui.setWidget(WIDGET_ID, undefined);

        if (result.aborted) return;

        if (result.error) {
          ctx.ui.notify(`qq error: ${result.error}`, "error");
          return;
        }

        if (!result.content) {
          ctx.ui.notify("No response generated", "warning");
          return;
        }

        const timestamp = Date.now();

        pi.sendMessage<QqDetails>(
          {
            customType: QQ_MESSAGE_TYPE,
            content: result.content,
            display: true,
            details: {
              question,
              answer: result.content,
              provider: model.provider,
              model: model.id,
              timestamp,
              usage: result.usage,
              runId: result.runId,
              totalDurationMs: result.totalDurationMs,
            },
          },
          { triggerTurn: false },
        );

        // If the agent is still working, mark the message as pending so
        // the renderer hides it. Show the result in a widget above the
        // editor instead. On the next turn (or agent end), the pending
        // state is cleared, the widget is removed, and the renderer
        // displays the message in its proper session position.
        if (!ctx.isIdle()) {
          qqPending.add(timestamp);
          showResultWidget(ctx, question, result.content, model);
        }
      } catch (err) {
        ctx.ui.setWidget(WIDGET_ID, undefined);
        ctx.ui.notify(
          `qq error: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    },
  });
}
