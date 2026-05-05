/**
 * Footer component with 2-line layout.
 *
 * Line 1: Path (left) + Stats (right aligned)
 * Line 2: Session name (left) + Model (right aligned)
 */

import {
  AD_PROVIDERS_CODEX_FAST_MODE_CHANGED_EVENT,
  AD_PROVIDERS_CODEX_FAST_MODE_READY_EVENT,
  AD_PROVIDERS_CODEX_FAST_MODE_REQUEST_EVENT,
  type AdProvidersCodexFastModeChangedEvent,
} from "@harness/events";
import type {
  ExtensionAPI,
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { GitStatusWatcher } from "../lib/git-status";
import { buildModelIdLine, buildModelLine } from "../lib/model";
import { buildPathParts } from "../lib/path-parts";
import {
  buildMinimalStatsParts,
  buildStatsParts,
  getContextUsage,
  getCumulativeUsage,
} from "../lib/stats";

/**
 * Create a footer component with 2-line layout.
 */
export function createCustomFooter(pi: ExtensionAPI) {
  let ctx: ExtensionContext | undefined;
  let requestRender: (() => void) | undefined;
  let codexFastModeEnabled = false;
  let gitStatusWatcher: GitStatusWatcher | undefined;

  pi.events.on(AD_PROVIDERS_CODEX_FAST_MODE_READY_EVENT, () => {
    if (!ctx) return;
    pi.events.emit(AD_PROVIDERS_CODEX_FAST_MODE_REQUEST_EVENT, { ctx });
  });

  pi.events.on(AD_PROVIDERS_CODEX_FAST_MODE_CHANGED_EVENT, (data: unknown) => {
    const event = (data ?? {}) as Partial<AdProvidersCodexFastModeChangedEvent>;
    codexFastModeEnabled = event.enabled === true;
    if (!ctx) return;
    requestRender?.();
  });

  const renderFooter = (
    width: number,
    theme: Theme,
    footer_data: ReadonlyFooterDataProvider,
  ): string[] => {
    if (!ctx) return [];

    const branch = footer_data.getGitBranch();
    const sessionName = ctx.sessionManager.getSessionName();

    const usage = getCumulativeUsage(ctx);
    const contextUsage = getContextUsage(ctx);

    const gitStatus = gitStatusWatcher?.getStatus();
    const pathData = buildPathParts(theme, branch, gitStatus);

    const statsParts = buildStatsParts(theme, usage, contextUsage);
    const statsLine = statsParts.join(" ");
    const statsWidth = visibleWidth(statsLine);
    const minPadding = 2;

    // Build line 1 with progressive degradation:
    // 1. Full: path + branch + stats
    // 2. Drop branch
    // 3. Truncate path
    let line1: string;
    let useMinimal = false;

    const buildLine1 = (
      leftStr: string,
      leftWidth: number,
      rightStr: string,
      rightWidth: number,
    ): string => {
      const pad = Math.max(0, width - leftWidth - rightWidth);
      return (
        leftStr +
        theme.fg("thinkingMinimal", " ".repeat(pad)) +
        theme.fg("thinkingMinimal", rightStr)
      );
    };

    // Full left side: path + branch
    const fullLeft =
      pathData.path + (pathData.branch ? ` ${pathData.branch}` : "");
    const fullLeftWidth = pathData.width;

    if (fullLeftWidth + minPadding + statsWidth <= width) {
      // Everything fits
      line1 = buildLine1(fullLeft, fullLeftWidth, statsLine, statsWidth);
    } else {
      // Drop branch, keep path + stats
      const noBranchLeft = pathData.path;
      const noBranchLeftWidth = pathData.pathWidth;

      if (noBranchLeftWidth + minPadding + statsWidth <= width) {
        line1 = buildLine1(
          noBranchLeft,
          noBranchLeftWidth,
          statsLine,
          statsWidth,
        );
      } else {
        // Drop stats too, switch to minimal mode
        useMinimal = true;
        const minimalStatsParts = buildMinimalStatsParts(
          theme,
          usage,
          contextUsage,
        );
        const minimalStatsLine = minimalStatsParts.join(" ");
        const minimalStatsWidth = visibleWidth(minimalStatsLine);

        const availForPath = Math.max(
          0,
          width - minPadding - minimalStatsWidth,
        );
        const truncPath = truncateToWidth(pathData.path, availForPath, "...");
        const truncPathWidth = visibleWidth(truncPath);
        const truncLeft = truncPath;
        const truncLeftWidth = truncPathWidth;

        line1 = buildLine1(
          truncLeft,
          truncLeftWidth,
          minimalStatsLine,
          minimalStatsWidth,
        );
      }
    }

    let line2: string;
    if (useMinimal) {
      const modelIdLine = buildModelIdLine(
        theme,
        ctx.model?.id,
        ctx.model?.provider,
        codexFastModeEnabled,
      );
      line2 = truncateToWidth(modelIdLine, width, "...");
    } else {
      const left_parts2: string[] = [sessionName ?? ""].filter(Boolean);
      const left_parts2_colored = left_parts2.map((s) =>
        theme.fg("thinkingMinimal", s),
      );
      const leftWidth2 = left_parts2.reduce(
        (sum, part) => sum + visibleWidth(part),
        0,
      );

      const thinkingLevel = pi.getThinkingLevel();
      const modelLine = buildModelLine(
        theme,
        ctx.model?.provider,
        ctx.model?.id,
        !!ctx.model?.reasoning,
        thinkingLevel ?? "off",
        codexFastModeEnabled,
      );
      const modelWidth = visibleWidth(modelLine);

      const paddingWidth2 = width - leftWidth2 - modelWidth;
      const padding2 =
        paddingWidth2 > 0
          ? theme.fg("thinkingMinimal", " ".repeat(Math.max(0, paddingWidth2)))
          : "";
      line2 = left_parts2_colored.join("") + padding2 + modelLine;

      const line2Width = visibleWidth(line2);
      if (line2Width > width) {
        const availableLeft2 = Math.max(0, width - (modelWidth + minPadding));
        if (availableLeft2 > 0) {
          const truncatedLeft2 = truncateToWidth(
            sessionName ?? "",
            availableLeft2,
            "",
          );
          const truncatedLeft2Colored = theme.fg(
            "thinkingMinimal",
            truncatedLeft2,
          );
          const newPadding2 = theme.fg(
            "thinkingMinimal",
            " ".repeat(
              Math.max(0, width - visibleWidth(truncatedLeft2) - modelWidth),
            ),
          );
          line2 = truncatedLeft2Colored + newPadding2 + modelLine;
        } else {
          line2 = truncateToWidth(modelLine, width, "...");
        }
      }
    }

    return [line1, line2];
  };

  return {
    setup: (context: ExtensionContext) => {
      ctx = context;
      pi.events.emit(AD_PROVIDERS_CODEX_FAST_MODE_REQUEST_EVENT, { ctx });
      ctx.ui.setFooter((tui, theme, footerData) => {
        requestRender = () => tui.requestRender?.();

        gitStatusWatcher?.dispose();
        gitStatusWatcher = new GitStatusWatcher(process.cwd(), () => {
          requestRender?.();
        });

        const unsub = footerData.onBranchChange(() => {
          requestRender?.();
        });

        return {
          dispose: () => {
            requestRender = undefined;
            gitStatusWatcher?.dispose();
            gitStatusWatcher = undefined;
            unsub();
          },
          invalidate() {},
          render(width: number): string[] {
            return renderFooter(width, theme, footerData);
          },
        };
      });
    },
    cleanup: () => {
      if (ctx) {
        ctx.ui.setFooter(undefined);
        ctx = undefined;
      }
    },
  };
}
