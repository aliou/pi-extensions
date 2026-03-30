import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  buildSessionContext,
  convertToLlm,
  serializeConversation,
} from "@mariozechner/pi-coding-agent";
import { Loader, visibleWidth } from "@mariozechner/pi-tui";
import { executeSubagent } from "@subagents/lib";
import { BTW_SYSTEM_REMINDER } from "../lib/system-prompt";
import { BTW_MESSAGE_TYPE, type BtwDetails } from "../lib/types";

const WIDGET_ID = "btw";

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

export function registerBtwCommand(pi: ExtensionAPI): void {
  pi.registerCommand("btw", {
    description: "Ask a quick side question without interrupting the agent",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/btw requires interactive mode", "error");
        return;
      }

      if (!ctx.model) {
        ctx.ui.notify("No model selected", "error");
        return;
      }

      const question = args?.trim();
      if (!question) {
        ctx.ui.notify("Usage: /btw <question>", "warning");
        return;
      }

      // Build conversation context
      const entries = ctx.sessionManager.getBranch();
      const sessionContext = buildSessionContext(
        entries,
        ctx.sessionManager.getLeafId(),
      );
      const llmMessages = convertToLlm(sessionContext.messages);

      // Filter out btw messages and in-progress assistant messages
      const filtered = llmMessages.filter((msg) => {
        const maybeCustom = msg as { customType?: unknown };
        if (maybeCustom.customType === BTW_MESSAGE_TYPE) return false;
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
      const systemPrompt = ctx.getSystemPrompt() + BTW_SYSTEM_REMINDER;
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
            `btw: ${question}`,
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
            name: "btw",
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
          ctx.ui.notify(`btw error: ${result.error}`, "error");
          return;
        }

        if (!result.content) {
          ctx.ui.notify("No response generated", "warning");
          return;
        }

        pi.sendMessage<BtwDetails>(
          {
            customType: BTW_MESSAGE_TYPE,
            content: result.content,
            display: true,
            details: {
              question,
              answer: result.content,
              provider: model.provider,
              model: model.id,
              timestamp: Date.now(),
              usage: result.usage,
              runId: result.runId,
              totalDurationMs: result.totalDurationMs,
            },
          },
          { triggerTurn: false },
        );
      } catch (err) {
        ctx.ui.setWidget(WIDGET_ID, undefined);
        ctx.ui.notify(
          `btw error: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        );
      }
    },
  });
}
