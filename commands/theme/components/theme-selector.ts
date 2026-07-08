import { Panel } from "@aliou/pi-utils-ui";
import {
  getSelectListTheme,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import {
  type Component,
  type Focusable,
  fuzzyFilter,
  Input,
  type SelectItem,
  SelectList,
  type SelectListTheme,
  Text,
  truncateToWidth,
} from "@earendil-works/pi-tui";

export class ThemeSelector implements Component, Focusable {
  private readonly searchInput: Input;
  private readonly options: SelectItem[];
  private readonly selectListTheme: SelectListTheme;
  private readonly onSelect: (value: string) => void;
  private readonly onCancel: () => void;
  private readonly onSelectionChange: (value: string) => void;
  private readonly currentIndex: number;
  private selectList: SelectList;
  private _focused = false;

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(
    private readonly theme: Theme,
    options: SelectItem[],
    currentIndex: number,
    onSelect: (value: string) => void,
    onCancel: () => void,
    onSelectionChange: (value: string) => void,
  ) {
    this.searchInput = new Input();
    const baseSelectListTheme = getSelectListTheme();
    this.options = options;
    this.currentIndex = currentIndex;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.onSelectionChange = onSelectionChange;
    this.selectListTheme = {
      ...baseSelectListTheme,
      noMatch: () => baseSelectListTheme.noMatch("  No matching themes"),
    };

    this.selectList = this.createSelectList(options, currentIndex);
  }

  handleInput(data: string): void {
    const previousFilter = this.searchInput.getValue();

    this.selectList.handleInput(data);

    this.searchInput.handleInput(data);

    const nextFilter = this.searchInput.getValue();
    if (nextFilter !== previousFilter) {
      const filteredOptions = fuzzyFilter(
        this.options,
        nextFilter,
        (item) => item.label || item.value,
      );
      this.selectList = this.createSelectList(
        filteredOptions,
        nextFilter ? 0 : this.currentIndex,
      );
      const selectedItem = this.selectList.getSelectedItem();
      if (selectedItem) {
        this.selectList.onSelectionChange?.(selectedItem);
      }
    }
  }

  render(width: number): string[] {
    const body: Component = {
      render: (contentWidth) => [
        truncateToWidth("Filter themes by name", contentWidth, ""),
        ...this.searchInput.render(contentWidth),
        "",
        ...this.selectList.render(contentWidth),
      ],
      invalidate: () => {},
    };

    return new Panel({
      title: "Select theme",
      titleStyle: (text) => this.theme.fg("accent", text),
      borderStyle: (text) => this.theme.fg("muted", text),
      border: "round",
      body,
      footer: new Text(
        this.theme.fg(
          "muted",
          "Type to filter · ↑/↓ preview · Enter select · Esc cancel",
        ),
        0,
        0,
      ),
    }).render(width);
  }

  invalidate(): void {
    this.searchInput.invalidate();
    this.selectList.invalidate();
  }

  private createSelectList(
    options: SelectItem[],
    selectedIndex: number,
  ): SelectList {
    const selectList = new SelectList(
      options,
      Math.min(options.length, 15),
      this.selectListTheme,
    );

    selectList.setSelectedIndex(selectedIndex);
    selectList.onSelect = (item) => this.onSelect(item.value);
    selectList.onCancel = this.onCancel;
    selectList.onSelectionChange = (item) => this.onSelectionChange(item.value);

    return selectList;
  }
}
