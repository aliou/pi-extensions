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

interface CompactOption {
  mode: CompactMode;
  edit: boolean;
}

function labelFor(option: CompactOption): string {
  const mode = option.mode === "simple" ? "Simple" : "Fast";
  return option.edit ? `${mode} compact (edit)` : `${mode} compact`;
}

const options: CompactOption[] = [
  { mode: "simple", edit: false },
  { mode: "fast", edit: false },
  { mode: "simple", edit: true },
  { mode: "fast", edit: true },
];

const items: SelectItem[] = options.map((option) => ({
  label: labelFor(option),
  value: `${option.mode}:${option.edit ? "edit" : "no-edit"}`,
}));

function parseValue(value: string): CompactOption {
  const [mode, editFlag] = value.split(":");
  return {
    mode: mode as CompactMode,
    edit: editFlag === "edit",
  };
}

export class CompactModePicker implements Component {
  private readonly list: SelectList;
  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly done: (result: CompactChoice | null) => void;

  private selectedIndex = 0;
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
    this.list.onSelect = (item) => {
      const option = parseValue(item.value);
      this.finish({ mode: option.mode, edit: option.edit });
    };
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
      this.selectedIndex =
        (this.selectedIndex - 1 + items.length) % items.length;
      this.list.setSelectedIndex(this.selectedIndex);
      this.list.invalidate();
      this.tui.requestRender();
      return;
    }

    this.list.handleInput(data);
  }

  render(width: number): string[] {
    let help = "↑↓ move · Tab/Shift+Tab move · Enter run · Esc default";
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
