import { Panel } from "@aliou/pi-utils-ui";
import {
  getSelectListTheme,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import {
  type Component,
  type SelectItem,
  SelectList,
  Text,
} from "@earendil-works/pi-tui";

export type SpawnMode = "blank" | "last" | "edit";

function modeItems(hasLastMessage: boolean): SelectItem[] {
  return [
    { label: "Blank", value: "blank" },
    ...(hasLastMessage
      ? [
          { label: "With last message", value: "last" },
          { label: "Edit last message in $EDITOR", value: "edit" },
        ]
      : []),
  ];
}

export class SpawnModePicker implements Component {
  private readonly list: SelectList;

  constructor(
    private readonly theme: Theme,
    onSelect: (mode: SpawnMode) => void,
    onCancel: () => void,
    hasLastMessage: boolean,
  ) {
    const items = modeItems(hasLastMessage);
    this.list = new SelectList(items, items.length, getSelectListTheme());
    this.list.onSelect = (item) => onSelect(item.value as SpawnMode);
    this.list.onCancel = onCancel;
  }

  handleInput(data: string): void {
    this.list.handleInput(data);
  }

  render(width: number): string[] {
    return new Panel({
      title: "Spawn child session",
      titleStyle: (text) => this.theme.fg("accent", text),
      borderStyle: (text) => this.theme.fg("muted", text),
      border: "round",
      body: this.list,
      footer: new Text(
        this.theme.fg("muted", "Enter select · Esc cancel"),
        0,
        0,
      ),
    }).render(width);
  }

  invalidate(): void {
    this.list.invalidate();
  }
}
