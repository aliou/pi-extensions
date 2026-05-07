import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";

export class Separator implements Component {
  constructor(private theme: Theme) {}

  render(width: number) {
    return [this.theme.fg("muted", "─".repeat(width))];
  }

  invalidate() {}
}
