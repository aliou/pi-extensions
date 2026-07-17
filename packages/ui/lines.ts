import type { Component } from "@earendil-works/pi-tui";

/**
 * One-line {@link Component} adapter for a render function. Useful as a
 * `Panel` footer that computes a single line from the available width.
 */
export class LineComponent implements Component {
  constructor(private readonly renderLine: (width: number) => string) {}
  render(width: number): string[] {
    return [this.renderLine(width)];
  }
  invalidate(): void {}
}

/**
 * {@link Component} adapter for a function returning pre-computed lines.
 * Useful as a `Panel` body when the lines are built outside the component
 * (e.g. a list rendered manually from items + selection state).
 */
export class LinesComponent implements Component {
  constructor(private readonly renderLines: (width: number) => string[]) {}
  render(width: number): string[] {
    return this.renderLines(width);
  }
  invalidate(): void {}
}
