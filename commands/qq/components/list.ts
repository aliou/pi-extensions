import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  type Component,
  getKeybindings,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import type { QqListItem } from "../context";

type Done = (item: QqListItem | null) => void;

export class QqList implements Component {
  private selectedIndex = 0;
  private maxVisible = 12;

  constructor(
    private items: QqListItem[],
    private theme: Theme,
    private done: Done,
  ) {}

  handleInput(data: string): void {
    const kb = getKeybindings();

    if (kb.matches(data, "tui.select.up")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      return;
    }

    if (kb.matches(data, "tui.select.down")) {
      this.selectedIndex = Math.min(
        this.items.length - 1,
        this.selectedIndex + 1,
      );
      return;
    }

    if (kb.matches(data, "tui.select.pageUp")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - this.maxVisible);
      return;
    }

    if (kb.matches(data, "tui.select.pageDown")) {
      this.selectedIndex = Math.min(
        this.items.length - 1,
        this.selectedIndex + this.maxVisible,
      );
      return;
    }

    if (kb.matches(data, "tui.select.confirm")) {
      this.done(this.items[this.selectedIndex] ?? null);
      return;
    }

    if (kb.matches(data, "tui.select.cancel")) {
      this.done(null);
    }
  }

  render(width: number): string[] {
    const lines: string[] = [];
    lines.push(...this.renderHeader(width));

    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(this.maxVisible / 2),
        this.items.length - this.maxVisible,
      ),
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.items.length);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.items[i];
      if (!item) continue;
      lines.push(this.renderItem(item, i === this.selectedIndex, width));
    }

    if (startIndex > 0 || endIndex < this.items.length) {
      lines.push(
        this.theme.fg(
          "muted",
          truncateToWidth(
            `  (${this.selectedIndex + 1}/${this.items.length})`,
            width,
          ),
        ),
      );
    }

    lines.push("");
    lines.push(this.renderFooter(width));
    return lines;
  }

  invalidate(): void {}

  private renderHeader(width: number): string[] {
    const title = this.theme.bold("Side chats");
    const count = this.theme.fg("muted", `${this.items.length} entries`);
    const spacing = Math.max(
      1,
      width - visibleWidth(title) - visibleWidth(count),
    );
    const titleLine = truncateToWidth(
      `${title}${" ".repeat(spacing)}${count}`,
      width,
      "",
      true,
    );

    const hints = this.theme.fg("muted", "↑/↓ select · enter add · esc close");
    const border = this.theme.fg("muted", "─".repeat(width));
    return [titleLine, hints, border, ""];
  }

  private renderFooter(width: number): string {
    return this.theme.fg("muted", "─".repeat(width));
  }

  private renderItem(
    item: QqListItem,
    selected: boolean,
    width: number,
  ): string {
    const cursor = selected ? this.theme.fg("accent", "  › ") : "    ";
    const status = statusLabel(item.status, this.theme);
    const age = this.theme.fg("dim", formatAge(new Date(item.entry.timestamp)));
    const prompt = firstLine(item.details.question);

    const prefix = `${cursor}${status} ${age} `;
    const available = Math.max(10, width - visibleWidth(prefix));
    const line = `${prefix}${truncateToWidth(prompt, available, "…")}`;

    if (selected) {
      return this.theme.bg(
        "selectedBg",
        truncateToWidth(line, width, "", true),
      );
    }

    return truncateToWidth(line, width, "", true);
  }
}

function statusLabel(status: QqListItem["status"], theme: Theme): string {
  switch (status) {
    case "available":
      return theme.fg("success", "available");
    case "available_after_compaction":
      return theme.fg("warning", "after compaction");
    case "in_context":
      return theme.fg("muted", "in context");
  }
}

function firstLine(text: string): string {
  return Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0);
      if (code === undefined) return "";
      return code < 32 || code === 127 ? " " : char;
    })
    .join("")
    .trim();
}

function formatAge(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}
