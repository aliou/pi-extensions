import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  type Component,
  matchesKey,
  visibleWidth,
} from "@earendil-works/pi-tui";
import type { ProviderUsageSnapshot } from "@harness/provider-usage";
import { ensureWidth, truncateSafe } from "./progress";
import { buildProviderTab } from "./provider-tab";

interface PanelTab {
  label: string;
  snapshot: ProviderUsageSnapshot;
}

export class UsagePanel implements Component {
  private activeTab = 0;
  private scrollOffset = 0;
  private cachedLines: string[] | null = null;
  private cachedWidth = 0;
  private readonly onClose: () => void;
  private readonly onRefresh: () => void;
  private readonly tabs: PanelTab[];
  private readonly theme: Theme;

  constructor(
    theme: Theme,
    snapshots: ProviderUsageSnapshot[],
    activeProvider: string | undefined,
    onClose: () => void,
    onRefresh: () => void,
  ) {
    this.theme = theme;
    this.onClose = onClose;
    this.onRefresh = onRefresh;
    this.tabs = sortSnapshots(snapshots, activeProvider).map((snapshot) => ({
      label: snapshot.displayName,
      snapshot,
    }));
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "escape") || data === "q") {
      this.onClose();
      return true;
    }
    if (
      this.tabs.length > 0 &&
      (matchesKey(data, "tab") || matchesKey(data, "shift+tab"))
    ) {
      const delta = matchesKey(data, "tab") ? 1 : -1;
      this.activeTab =
        (this.activeTab + delta + this.tabs.length) % this.tabs.length;
      this.scrollOffset = 0;
      this.invalidate();
      return true;
    }

    const maxVisible = 17;
    const maxScroll = Math.max(0, (this.cachedLines?.length ?? 0) - maxVisible);
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
      this.cachedLines = tab
        ? buildProviderTab(tab.snapshot, contentWidth, theme)
        : [theme.fg("dim", "No provider usage data")];
      this.cachedWidth = width;
    }

    const maxVisible = 17;
    const totalLines = this.cachedLines.length;
    const end = Math.min(this.scrollOffset + maxVisible, totalLines);
    const lines: string[] = [];
    const border = theme.fg("border", "─".repeat(width));

    lines.push(border);
    lines.push(
      truncateSafe(
        ` ${theme.fg("accent", theme.bold("Provider Usage"))}`,
        width,
        theme,
      ),
    );
    lines.push(this.renderTabBar(width, theme));
    lines.push(
      this.scrollOffset > 0
        ? truncateSafe(
            theme.fg("dim", `  ↑ ${this.scrollOffset} lines above`),
            width,
            theme,
          )
        : "",
    );

    for (let i = this.scrollOffset; i < end; i++)
      lines.push(truncateSafe(`  ${this.cachedLines[i] ?? ""}`, width, theme));
    const shown = end - this.scrollOffset;
    for (let i = shown; i < maxVisible; i++) lines.push("");

    const remaining = totalLines - this.scrollOffset - maxVisible;
    lines.push(
      remaining > 0
        ? truncateSafe(
            theme.fg("dim", `  ↓ ${remaining} lines below`),
            width,
            theme,
          )
        : "",
    );
    lines.push("");
    lines.push(
      truncateSafe(this.renderFooter(width, remaining > 0), width, theme),
    );
    lines.push(border);

    return ensureWidth(lines, width, theme);
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = 0;
  }

  private renderTabBar(width: number, theme: Theme): string {
    if (this.tabs.length === 0) return "";
    const parts: string[] = [];
    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i];
      if (!tab) continue;
      parts.push(
        i === this.activeTab
          ? theme.fg("accent", theme.bold(` ${tab.label} `))
          : theme.fg("dim", ` ${tab.label} `),
      );
      if (i < this.tabs.length - 1) parts.push(theme.fg("borderMuted", "│"));
    }
    return truncateSafe(`  ${parts.join("")}`, width, theme);
  }

  private renderFooter(width: number, canScroll: boolean): string {
    const theme = this.theme;
    let left = theme.fg("dim", "Tab switch");
    if (canScroll) left += `  ${theme.fg("dim", "j/k scroll")}`;
    left += `  ${theme.fg("dim", "r refresh status")}`;
    const right = theme.fg("dim", "q close");
    const gap = Math.max(
      2,
      width - visibleWidth(left) - visibleWidth(right) - 4,
    );
    return `  ${left}${" ".repeat(gap)}${right}`;
  }
}

function sortSnapshots(
  snapshots: ProviderUsageSnapshot[],
  activeProvider: string | undefined,
): ProviderUsageSnapshot[] {
  return [...snapshots].sort((a, b) => {
    if (activeProvider) {
      const norm = (s: string) => s.replace(/[-_]/g, "").toLowerCase();
      const active = norm(activeProvider);
      if (norm(a.provider) === active) return -1;
      if (norm(b.provider) === active) return 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}
