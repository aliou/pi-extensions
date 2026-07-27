import type { Component } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const ANSI_ESCAPE_PATTERN = String.raw`\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1B\\))`;
const TRAILING_STYLED_PADDING = new RegExp(
  String.raw`[ \t]+(?=(?:${ANSI_ESCAPE_PATTERN})*$)`,
  "u",
);

/** Render any activity component as one width-bounded line. */
export class CollapsedLine implements Component {
  constructor(private readonly child: Component) {}

  render(width: number): string[] {
    if (width <= 0) return [""];

    let content = "";
    for (const renderedLine of this.child.render(width)) {
      const line = trimRenderedLine(renderedLine);
      if (visibleWidth(line) === 0) continue;

      content = content ? `${content} ${line}` : line;
      if (visibleWidth(content) > width) break;
    }

    return [truncateToWidth(content, width, "…")];
  }

  invalidate(): void {
    this.child.invalidate();
  }
}

function trimRenderedLine(line: string): string {
  return line.trimEnd().replace(TRAILING_STYLED_PADDING, "");
}
