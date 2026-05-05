import { getSelectListTheme } from "@mariozechner/pi-coding-agent";
import { Container, type SelectItem, SelectList } from "@mariozechner/pi-tui";

export class ThemeSelector extends Container {
  private selectList: SelectList;

  constructor(
    options: SelectItem[],
    currentIndex: number,
    onSelect: (value: string) => void,
    onCancel: () => void,
    onSelectionChange: (value: string) => void,
  ) {
    super();

    this.selectList = new SelectList(
      options,
      Math.min(options.length, 15),
      getSelectListTheme(),
    );

    this.selectList.setSelectedIndex(currentIndex);
    this.selectList.onSelect = (item) => onSelect(item.value);
    this.selectList.onCancel = onCancel;
    this.selectList.onSelectionChange = (item) => onSelectionChange(item.value);
  }

  handleInput(data: string): void {
    this.selectList.handleInput(data);
  }

  override render(width: number): string[] {
    return this.selectList.render(width);
  }
}
