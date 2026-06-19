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

interface StepList {
  items: SelectItem[];
  list: SelectList;
  index: number;
}

export class CompactModePicker implements Component {
  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly done: (result: CompactChoice | null) => void;

  private step: "mode" | "edit" = "mode";
  private selectedMode: CompactMode = "simple";
  private settled = false;
  private remainingSeconds = AUTO_SELECT_DELAY_SECONDS;
  private timer?: ReturnType<typeof setInterval>;
  private timerActive = true;

  private readonly mode: StepList;
  private readonly edit: StepList;

  constructor(
    tui: TUI,
    theme: Theme,
    done: (result: CompactChoice | null) => void,
  ) {
    this.tui = tui;
    this.theme = theme;
    this.done = done;

    const modeItems: SelectItem[] = [
      { label: "Simple compact", value: "simple" },
      { label: "Fast compact", value: "fast" },
    ];

    const editItems: SelectItem[] = [
      { label: "Continue", value: "no-edit" },
      { label: "Edit summary", value: "edit" },
    ];

    this.mode = this.buildStep(modeItems, (item) => {
      this.selectedMode = item.value as CompactMode;
      this.step = "edit";
      this.tui.requestRender();
    });

    this.edit = this.buildStep(editItems, (item) => {
      this.finish({
        mode: this.selectedMode,
        edit: item.value === "edit",
      });
    });

    this.mode.list.onCancel = () => this.finish(null);
    this.edit.list.onCancel = () => {
      this.step = "mode";
      this.tui.requestRender();
    };

    this.startTimer();
  }

  handleInput(data: string): void {
    if (this.settled) return;

    this.cancelTimer();

    const step = this.currentStep();

    if (matchesKey(data, Key.tab)) {
      step.index = (step.index + 1) % step.items.length;
      step.list.setSelectedIndex(step.index);
      step.list.invalidate();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.shift("tab"))) {
      step.index = (step.index - 1 + step.items.length) % step.items.length;
      step.list.setSelectedIndex(step.index);
      step.list.invalidate();
      this.tui.requestRender();
      return;
    }

    step.list.handleInput(data);
  }

  render(width: number): string[] {
    const step = this.currentStep();
    const title =
      this.step === "mode" ? "Compaction mode" : "Compaction options";

    let help = "↑↓ move · Tab/Shift+Tab move · Enter select";
    if (this.step === "mode") {
      help += " · Esc default";
      if (this.timerActive) {
        help += ` · default in ${this.remainingSeconds}s`;
      }
    } else {
      help += " · Esc back";
    }

    const footer = new Text(this.theme.fg("muted", help), 0, 0);

    return new Panel({
      title,
      titleStyle: (text) => this.theme.fg("accent", text),
      borderStyle: (text) => this.theme.fg("muted", text),
      border: "round",
      body: step.list,
      footer,
    }).render(width);
  }

  invalidate(): void {
    this.mode.list.invalidate();
    this.edit.list.invalidate();
  }

  private buildStep(
    items: SelectItem[],
    onSelect: (item: SelectItem) => void,
  ): StepList {
    const list = new SelectList(items, items.length, getSelectListTheme());
    const step: StepList = { items, list, index: 0 };

    list.onSelect = (item) => {
      step.index = items.findIndex((i) => i.value === item.value);
      onSelect(item);
    };
    list.onSelectionChange = (item) => {
      step.index = items.findIndex((i) => i.value === item.value);
    };

    return step;
  }

  private currentStep(): StepList {
    return this.step === "mode" ? this.mode : this.edit;
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
