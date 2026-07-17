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

export type QqMode = "new" | "resume" | "display";

/**
 * Initial intent picker shown when qq history exists. Mirrors SpawnModePicker:
 * Panel + SelectList, Enter selects, Esc cancels. The `display` option is
 * omitted when an arg was already typed (browsing is a detour then).
 */
export class QqModePicker implements Component {
  private readonly list: SelectList;

  constructor(
    private readonly theme: Theme,
    onSelect: (mode: QqMode) => void,
    onCancel: () => void,
    includeDisplay: boolean,
  ) {
    const items: SelectItem[] = [
      { label: "New side chat", value: "new" },
      { label: "Resume side chat", value: "resume" },
      ...(includeDisplay
        ? [{ label: "Display past answer", value: "display" }]
        : []),
    ];
    this.list = new SelectList(items, items.length, getSelectListTheme());
    this.list.onSelect = (item) => onSelect(item.value as QqMode);
    this.list.onCancel = onCancel;
  }

  handleInput(data: string): void {
    this.list.handleInput(data);
  }

  render(width: number): string[] {
    return new Panel({
      title: "qq",
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
