import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";

export class Separator implements Component {
  constructor(private theme: Theme) {}

  render(width: number) {
    return [this.theme.fg("muted", "─".repeat(width))];
  }

  invalidate() {}
}
