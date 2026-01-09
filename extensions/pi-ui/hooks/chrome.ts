import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import {
  CONTEXT_ERROR_THRESHOLD,
  CONTEXT_WARNING_THRESHOLD,
} from "../constants";
import { formatTokens, getGitBranch, getPiVersion, stripAnsi } from "../utils";

export function setupChromeHook(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const theme = ctx.ui.theme;
    const version = getPiVersion();

    // Header
    ctx.ui.setHeader((_tui, _theme) => ({
      render(width: number): string[] {
        const logo =
          theme.bold(theme.fg("accent", "pi")) +
          theme.fg("dim", ` v${version}`);
        return [truncateToWidth(` ${logo}`, width), ""];
      },
      invalidate() {},
    }));

    // Footer
    ctx.ui.setFooter((_tui, _theme) => ({
      render(width: number): string[] {
        const gitBranch = getGitBranch(ctx.cwd);

        // Calculate totals from all session entries
        let totalInput = 0;
        let totalOutput = 0;
        let totalCacheRead = 0;
        let totalCacheWrite = 0;
        let totalCost = 0;

        for (const entry of ctx.sessionManager.getEntries()) {
          if (entry.type === "message" && entry.message.role === "assistant") {
            const msg = entry.message as AssistantMessage;
            totalInput += msg.usage.input;
            totalOutput += msg.usage.output;
            totalCacheRead += msg.usage.cacheRead;
            totalCacheWrite += msg.usage.cacheWrite;
            totalCost += msg.usage.cost.total;
          }
        }

        // Get last assistant message for context percentage
        const entries = ctx.sessionManager.getBranch();
        let lastAssistant: AssistantMessage | undefined;
        for (let i = entries.length - 1; i >= 0; i--) {
          const entry = entries[i];
          if (entry.type === "message" && entry.message.role === "assistant") {
            const msg = entry.message as AssistantMessage;
            if (msg.stopReason !== "aborted") {
              lastAssistant = msg;
              break;
            }
          }
        }

        const contextTokens = lastAssistant
          ? lastAssistant.usage.input +
            lastAssistant.usage.output +
            lastAssistant.usage.cacheRead +
            lastAssistant.usage.cacheWrite
          : 0;
        const contextWindow = ctx.model?.contextWindow || 0;
        const contextPercentValue =
          contextWindow > 0 ? (contextTokens / contextWindow) * 100 : 0;
        const contextPercent = contextPercentValue.toFixed(1);

        // Build pwd with git branch
        let pwd = ctx.cwd;
        const home = process.env.HOME || process.env.USERPROFILE;
        if (home && pwd.startsWith(home)) {
          pwd = `~${pwd.slice(home.length)}`;
        }
        if (gitBranch) {
          pwd = `${pwd} (${gitBranch})`;
        }
        if (pwd.length > width) {
          const half = Math.floor(width / 2) - 2;
          if (half > 0) {
            const start = pwd.slice(0, half);
            const end = pwd.slice(-(half - 1));
            pwd = `${start}...${end}`;
          } else {
            pwd = pwd.slice(0, Math.max(1, width));
          }
        }

        // Build stats left side
        const statsParts: string[] = [];
        if (totalInput) statsParts.push(`↑${formatTokens(totalInput)}`);
        if (totalOutput) statsParts.push(`↓${formatTokens(totalOutput)}`);
        if (totalCacheRead) statsParts.push(`R${formatTokens(totalCacheRead)}`);
        if (totalCacheWrite)
          statsParts.push(`W${formatTokens(totalCacheWrite)}`);

        // Context percentage with color
        const autoIndicator = " (auto)";
        const contextPercentDisplay = `${contextPercent}%/${formatTokens(contextWindow)}${autoIndicator}`;
        let contextPercentStr: string;
        if (contextPercentValue > CONTEXT_ERROR_THRESHOLD) {
          contextPercentStr = theme.fg("error", contextPercentDisplay);
        } else if (contextPercentValue > CONTEXT_WARNING_THRESHOLD) {
          contextPercentStr = theme.fg("warning", contextPercentDisplay);
        } else {
          contextPercentStr = contextPercentDisplay;
        }
        statsParts.push(contextPercentStr);

        let statsLeft = statsParts.join(" ");

        // Build right side: cost, model, thinking
        const rightParts: string[] = [];

        // Cost (always show)
        rightParts.push(`$${totalCost.toFixed(3)}`);

        // Model name
        const modelName = ctx.model?.id || "no-model";
        rightParts.push(modelName);

        // Thinking level
        if (ctx.model?.reasoning) {
          const thinkingLevel = pi.getThinkingLevel();
          if (thinkingLevel === "off") {
            rightParts.push(theme.fg("error", "off"));
          } else {
            rightParts.push(thinkingLevel);
          }
        } else {
          rightParts.push(theme.fg("warning", "(none)"));
        }

        const rightSide = rightParts.join(" • ");

        let statsLeftWidth = visibleWidth(statsLeft);
        const rightSideWidth = visibleWidth(rightSide);

        if (statsLeftWidth > width) {
          const plainStatsLeft = stripAnsi(statsLeft);
          statsLeft = `${plainStatsLeft.substring(0, width - 3)}...`;
          statsLeftWidth = visibleWidth(statsLeft);
        }

        const minPadding = 2;
        const totalNeeded = statsLeftWidth + minPadding + rightSideWidth;

        let statsLine: string;
        if (totalNeeded <= width) {
          const padding = " ".repeat(width - statsLeftWidth - rightSideWidth);
          statsLine = statsLeft + padding + rightSide;
        } else {
          const availableForRight = width - statsLeftWidth - minPadding;
          if (availableForRight > 3) {
            const plainRightSide = stripAnsi(rightSide);
            const truncatedPlain = plainRightSide.substring(
              0,
              availableForRight,
            );
            const padding = " ".repeat(
              width - statsLeftWidth - truncatedPlain.length,
            );
            statsLine = statsLeft + padding + truncatedPlain;
          } else {
            statsLine = statsLeft;
          }
        }

        const dimStatsLeft = theme.fg("dim", statsLeft);
        const remainder = statsLine.slice(statsLeft.length);
        const dimRemainder = theme.fg("dim", remainder);

        return [theme.fg("dim", pwd), dimStatsLeft + dimRemainder];
      },
      invalidate() {},
    }));
  });
}
