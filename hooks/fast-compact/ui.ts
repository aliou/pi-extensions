import { Panel } from "@aliou/pi-utils-ui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { getSelectListTheme } from "@earendil-works/pi-coding-agent";
import {
  type Component,
  Key,
  matchesKey,
  type SelectItem,
  SelectList,
  Text,
  type TUI,
} from "@earendil-works/pi-tui";

import type { CompactChoice, CompactMode } from "./types";

const AUTO_SELECT_DELAY_SECONDS = 30;

const items: SelectItem[] = [
  { label: "Simple compact", value: "simple" },
  { label: "Fast compact", value: "fast" },
];

export class CompactModePicker implements Component {
  private readonly list: SelectList;
  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly done: (result: CompactChoice | null) => void;

  private selectedIndex = 0;
  private edit = false;
  private settled = false;
  private remainingSeconds = AUTO_SELECT_DELAY_SECONDS;
  private timer?: ReturnType<typeof setInterval>;
  private timerActive = true;

  constructor(
    tui: TUI,
    theme: Theme,
    done: (result: CompactChoice | null) => void,
  ) {
    this.tui = tui;
    this.theme = theme;
    this.done = done;

    this.list = new SelectList(items, items.length, getSelectListTheme());
    this.list.onSelect = (item) =>
      this.finish({ mode: item.value as CompactMode, edit: this.edit });
    this.list.onCancel = () => this.finish(null);
    this.list.onSelectionChange = (item) => {
      this.selectedIndex = items.findIndex((i) => i.value === item.value);
    };

    this.startTimer();
  }

  handleInput(data: string): void {
    if (this.settled) return;

    this.cancelTimer();

    if (matchesKey(data, Key.tab)) {
      this.selectedIndex = (this.selectedIndex + 1) % items.length;
      this.list.setSelectedIndex(this.selectedIndex);
      this.list.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.shift("tab"))) {
      this.edit = !this.edit;
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    this.list.handleInput(data);
  }

  render(width: number): string[] {
    const editLabel = this.edit ? "on" : "off";
    let help = `Tab mode · Shift+Tab edit · Enter run · Esc default · edit: ${editLabel}`;
    if (this.timerActive) {
      help += ` · default in ${this.remainingSeconds}s`;
    }
    const footer = new Text(this.theme.fg("muted", help), 0, 0);

    return new Panel({
      title: "Compaction",
      titleStyle: (text) => this.theme.fg("accent", text),
      borderStyle: (text) => this.theme.fg("muted", text),
      border: "round",
      body: this.list,
      footer,
    }).render(width);
  }

  invalidate(): void {
    this.list.invalidate();
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      if (this.settled) return;
      this.remainingSeconds -= 1;

      if (this.remainingSeconds <= 0) {
        this.finish(null);
        return;
      }

      this.tui.requestRender();
    }, 1000);
  }

  private cancelTimer(): void {
    if (!this.timerActive) return;
    this.timerActive = false;
    clearInterval(this.timer);
    this.tui.requestRender();
  }

  private finish(result: CompactChoice | null): void {
    if (this.settled) return;
    this.settled = true;
    clearInterval(this.timer);
    this.timerActive = false;
    this.done(result);
  }
}
