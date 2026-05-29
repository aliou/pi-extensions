import {
  BorderedLoader,
  type ExtensionAPI,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import {
  type Component,
  matchesKey,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import type {
  LimitViewModel,
  NormalizedLimit,
  ProviderSnapshot,
} from "@harness/provider-usage";
import { fetchAllProviders } from "@harness/provider-usage";
import { getSeverityColor } from "../lib/engine";
import { buildViewModels } from "../lib/view";

// === Width-safe rendering ===

function truncateSafe(text: string, width: number, theme: Theme): string {
  if (width <= 0) return "";
  if (visibleWidth(text) <= width) return text;
  if (width <= 3) return text.slice(0, width);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI
  const plain = text.replace(/\u001b\[[0-9;]*m/g, "");
  return `${plain.slice(0, Math.max(0, width - 3))}${theme.fg("dim", "...")}`;
}

function ensureWidth(lines: string[], width: number, theme: Theme): string[] {
  return lines.map((line) => {
    if (visibleWidth(line) <= width) return line;
    const wrapped = wrapTextWithAnsi(line, width);
    return wrapped[0] ?? truncateSafe(line, width, theme);
  });
}

// === Progress bar ===

function renderProgressBar(
  percent: number,
  width: number,
  theme: Theme,
  fillColor: "success" | "warning" | "error",
  pacePercent?: number | null,
): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((clamped / 100) * width);
  const paceIndex =
    pacePercent == null || pacePercent <= percent
      ? null
      : Math.round((Math.max(0, Math.min(100, pacePercent)) / 100) * width);

  const parts: string[] = [];
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      parts.push(theme.fg(fillColor, "\u2588"));
    } else if (paceIndex !== null && i < paceIndex) {
      parts.push(theme.fg(fillColor, "\u2593"));
    } else {
      parts.push(theme.fg("dim", "\u2591"));
    }
  }
  return parts.join("");
}

// === Limit block rendering ===

function renderLimitBlock(
  vm: LimitViewModel,
  width: number,
  theme: Theme,
  locked?: boolean,
): string[] {
  const lines: string[] = [];
  const barWidth = Math.min(50, Math.max(20, width - 20));
  const color = getSeverityColor(vm.severity);

  // Title line.
  const titleParts = [theme.fg(locked ? "dim" : "accent", vm.title)];
  if (vm.subtitle) titleParts.push(theme.fg("dim", ` (${vm.subtitle})`));
  if (locked) titleParts.push(theme.fg("dim", " (blocked)"));
  lines.push(`  ${titleParts.join("")}`);

  // Progress bar + usage label.
  if (locked) {
    // Render a fully muted bar with a distinct character.
    const lockedBar = theme.fg("dim", "\u2592".repeat(barWidth));
    lines.push(`  ${lockedBar} ${theme.fg("dim", vm.usageLabel)}`);
  } else {
    const bar = renderProgressBar(
      vm.usedPercent,
      barWidth,
      theme,
      color,
      vm.pacePercent,
    );
    lines.push(`  ${bar} ${theme.fg(color, vm.usageLabel)}`);
  }

  // Metadata line (skip for locked windows).
  if (locked) return lines;

  const leftParts: string[] = [];
  // Only show projection for fixed-window limits (not refillable/budget).
  if (
    vm.projectedPercent != null &&
    vm.projectedPercent > 0 &&
    !vm.isRefillable
  ) {
    const projStr = `proj ${Math.round(vm.projectedPercent)}%`;
    leftParts.push(
      vm.severity !== "none"
        ? theme.fg(color, projStr)
        : theme.fg("dim", projStr),
    );
  }
  if (vm.message) {
    leftParts.push(theme.fg("dim", vm.message));
  }

  const leftStr = leftParts.join("  ");
  const rightStr = vm.renewsLabel ? theme.fg("dim", vm.renewsLabel) : "";
  const leftW = visibleWidth(leftStr);
  const rightW = visibleWidth(rightStr);
  const gap = Math.max(2, barWidth - leftW - rightW);
  if (leftStr || rightStr) {
    lines.push(`  ${leftStr}${" ".repeat(gap)}${rightStr}`);
  }

  return lines;
}

// === Window filtering ===

/**
 * Returns the set of scopes where a 7-day window is at 100%.
 * Used to render the corresponding 5h window in a muted/locked style.
 */
function findFullWeeklyScopes(limits: NormalizedLimit[]): Set<string> {
  const scopes = new Set<string>();
  for (const limit of limits) {
    if (limit.kind !== "fixed-window") continue;
    const ws = limit.windowSeconds ?? 0;
    if (ws >= 6 * 24 * 60 * 60 && limit.usedPercent >= 100) {
      scopes.add(limit.scope ?? "");
    }
  }
  return scopes;
}

function is5hWindow(limit: NormalizedLimit): boolean {
  if (limit.kind !== "fixed-window") return false;
  const ws = limit.windowSeconds ?? 0;
  return ws > 0 && ws <= 6 * 60 * 60;
}

// === Provider tab rendering ===

async function buildProviderTab(
  snapshot: ProviderSnapshot,
  width: number,
  theme: Theme,
): Promise<string[]> {
  const lines: string[] = [];

  // Status.
  let statusColor: "success" | "warning" | "error" | "dim" = "dim";
  let statusText = "Unknown";
  switch (snapshot.status) {
    case "operational":
      statusColor = "success";
      statusText = "Operational";
      break;
    case "degraded":
      statusColor = "warning";
      statusText = "Degraded";
      break;
    case "outage":
      statusColor = "error";
      statusText = "Outage";
      break;
  }
  lines.push(`  Status: ${theme.fg(statusColor, `\u25cf ${statusText}`)}`);
  lines.push("");

  if (snapshot.error) {
    lines.push(theme.fg("error", `Error: ${snapshot.error}`));
    return lines;
  }

  if (!snapshot.limits.length) {
    lines.push(theme.fg("dim", "No rate limit data"));
    return lines;
  }

  // Build view models.
  const fullWeeklyScopes = findFullWeeklyScopes(snapshot.limits);
  const viewModels = await buildViewModels(snapshot.limits);

  for (let i = 0; i < viewModels.length; i++) {
    const vm = viewModels[i];
    if (!vm) continue;
    const limit = snapshot.limits[i];
    const locked =
      limit && is5hWindow(limit) && fullWeeklyScopes.has(limit.scope ?? "");
    lines.push(...renderLimitBlock(vm, width, theme, locked));
    lines.push("");
  }

  // Trim trailing blank lines.
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  return lines;
}

// === Panel component ===

interface PanelTab {
  label: string;
  snapshot: ProviderSnapshot;
}

class UsagePanel implements Component {
  private activeTab = 0;
  private scrollOffset = 0;
  private cachedLines: string[] | null = null;
  private cachedWidth = 0;
  private onClose: () => void;
  private onRefresh: () => void;
  private tabs: PanelTab[];
  private theme: Theme;

  constructor(
    theme: Theme,
    snapshots: ProviderSnapshot[],
    activeProvider: string | undefined,
    onClose: () => void,
    onRefresh: () => void,
  ) {
    this.theme = theme;
    this.onClose = onClose;
    this.onRefresh = onRefresh;

    // Sort: active provider first, then alphabetical.
    const sorted = [...snapshots].sort((a, b) => {
      if (activeProvider) {
        const norm = (s: string) => s.replace(/[-_]/g, "").toLowerCase();
        const active = norm(activeProvider);
        if (norm(a.provider) === active) return -1;
        if (norm(b.provider) === active) return 1;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    this.tabs = sorted.map((s) => ({ label: s.displayName, snapshot: s }));
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "escape") || data === "q") {
      this.onClose();
      return true;
    }

    if (matchesKey(data, "tab")) {
      this.activeTab = (this.activeTab + 1) % this.tabs.length;
      this.scrollOffset = 0;
      this.invalidate();
      return true;
    }
    if (matchesKey(data, "shift+tab")) {
      this.activeTab =
        (this.activeTab - 1 + this.tabs.length) % this.tabs.length;
      this.scrollOffset = 0;
      this.invalidate();
      return true;
    }

    const maxVisible = 17;
    const totalLines = this.cachedLines?.length ?? 0;
    const maxScroll = Math.max(0, totalLines - maxVisible);

    if (data === "j" || matchesKey(data, "down")) {
      if (this.scrollOffset < maxScroll) this.scrollOffset++;
      return true;
    }
    if (data === "k" || matchesKey(data, "up")) {
      if (this.scrollOffset > 0) this.scrollOffset--;
      return true;
    }
    if (data === " " || matchesKey(data, "pageDown")) {
      this.scrollOffset = Math.min(this.scrollOffset + maxVisible, maxScroll);
      return true;
    }
    if (matchesKey(data, "pageUp")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - maxVisible);
      return true;
    }

    if (data === "r") {
      this.onRefresh();
      return true;
    }

    return false;
  }

  render(width: number): string[] {
    const theme = this.theme;
    const contentWidth = Math.max(1, width - 2);

    if (!this.cachedLines || this.cachedWidth !== width) {
      const tab = this.tabs[this.activeTab];
      // Build content synchronously from last async result or empty.
      // The async build is triggered in invalidate().
      if (tab && !this.cachedLines) {
        this.cachedLines = [theme.fg("dim", "Loading...")];
        this.cachedWidth = width;
        buildProviderTab(tab.snapshot, contentWidth, theme).then((lines) => {
          this.cachedLines = lines;
          this.cachedWidth = width;
        });
      }
    }

    const maxVisible = 17;
    const totalLines = this.cachedLines?.length ?? 0;
    const lines: string[] = [];

    const border = theme.fg("border", "\u2500".repeat(width));
    lines.push(border);
    lines.push(
      truncateSafe(
        ` ${theme.fg("accent", theme.bold("Provider Usage"))}`,
        width,
        theme,
      ),
    );
    lines.push(this.renderTabBar(width, theme));

    if (this.scrollOffset > 0) {
      lines.push(
        truncateSafe(
          theme.fg("dim", `  \u2191 ${this.scrollOffset} lines above`),
          width,
          theme,
        ),
      );
    } else {
      lines.push("");
    }

    const end = Math.min(this.scrollOffset + maxVisible, totalLines);
    for (let i = this.scrollOffset; i < end; i++) {
      lines.push(
        truncateSafe(`  ${this.cachedLines?.[i] ?? ""}`, width, theme),
      );
    }

    const shown = end - this.scrollOffset;
    for (let i = shown; i < maxVisible; i++) lines.push("");

    const remaining = totalLines - this.scrollOffset - maxVisible;
    if (remaining > 0) {
      lines.push(
        truncateSafe(
          theme.fg("dim", `  \u2193 ${remaining} lines below`),
          width,
          theme,
        ),
      );
    } else {
      lines.push("");
    }

    lines.push("");
    lines.push(
      truncateSafe(this.renderFooter(width, remaining > 0), width, theme),
    );
    lines.push(border);

    return ensureWidth(lines, width, theme);
  }

  private renderTabBar(width: number, theme: Theme): string {
    const parts: string[] = [];
    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i];
      if (!tab) continue;
      if (i === this.activeTab) {
        parts.push(theme.fg("accent", theme.bold(` ${tab.label} `)));
      } else {
        parts.push(theme.fg("dim", ` ${tab.label} `));
      }
      if (i < this.tabs.length - 1) {
        parts.push(theme.fg("borderMuted", "\u2502"));
      }
    }
    return truncateSafe(`  ${parts.join("")}`, width, theme);
  }

  private renderFooter(width: number, canScroll: boolean): string {
    const theme = this.theme;
    let left = theme.fg("dim", "Tab switch");
    if (canScroll) left += `  ${theme.fg("dim", "j/k scroll")}`;
    left += `  ${theme.fg("dim", "r refresh")}`;
    const right = theme.fg("dim", "q close");
    const leftW = visibleWidth(left);
    const rightW = visibleWidth(right);
    const gap = Math.max(2, width - leftW - rightW - 4);
    return `  ${left}${" ".repeat(gap)}${right}`;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = 0;
  }
}

// === Command ===

export function setupUsageCommand(pi: ExtensionAPI): void {
  pi.registerCommand("providers:usage", {
    description: "Show provider usage dashboard",
    handler: async (_args, cmdCtx) => {
      if (!cmdCtx.hasUI) {
        cmdCtx.ui.notify("/providers:usage requires interactive mode", "error");
        return;
      }

      const authStorage = cmdCtx.modelRegistry.authStorage;
      const activeProvider = cmdCtx.model?.provider;

      await cmdCtx.ui.custom((tui, theme, _kb, done) => {
        const loader = new BorderedLoader(tui, theme, "Loading usage...");
        loader.onAbort = () => done(undefined);

        let panel: UsagePanel | null = null;

        const loadData = (force = false) => {
          fetchAllProviders(authStorage, loader.signal, force)
            .then((snapshots) => {
              if (loader.signal.aborted) return;
              panel = new UsagePanel(
                theme,
                snapshots,
                activeProvider,
                () => done(undefined),
                () => {
                  panel = null;
                  tui.requestRender();
                  loadData(true);
                },
              );
              tui.requestRender();
            })
            .catch(() => {
              if (loader.signal.aborted) return;
              panel = new UsagePanel(
                theme,
                [],
                activeProvider,
                () => done(undefined),
                () => {
                  panel = null;
                  tui.requestRender();
                  loadData(true);
                },
              );
              tui.requestRender();
            });
        };

        loadData();

        return {
          handleInput: (data: string) =>
            panel ? panel.handleInput(data) : loader.handleInput(data),
          render: (width: number) =>
            panel ? panel.render(width) : loader.render(width),
          invalidate: () => {
            panel?.invalidate();
            loader.invalidate();
          },
          dispose: () => loader.dispose(),
        };
      });
    },
  });
}
