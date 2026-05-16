import { Panel, Stack } from "@aliou/pi-utils-ui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Loader, Text, type TUI } from "@earendil-works/pi-tui";

export class SplitReviewWaitingPanel implements Component {
  private loader: Loader;

  constructor(
    tui: TUI,
    private theme: Theme,
  ) {
    this.loader = new Loader(
      tui,
      (text) => theme.fg("accent", text),
      (text) => theme.fg("toolTitle", text),
      "Waiting for review editor",
    );
    this.loader.start();
  }

  render(width: number): string[] {
    const body = new Stack({ gap: 1 });
    body.addChild(this.loader);
    body.addChild(
      new Text(
        this.theme.fg(
          "muted",
          "Save and close the editor in the split to continue.",
        ),
        0,
        0,
      ),
    );

    return new Panel({
      title: "Review in progress",
      body,
      border: "round",
      borderStyle: (text) => this.theme.fg("dim", text),
      titleStyle: (text) => this.theme.fg("accent", text),
    }).render(width);
  }

  invalidate(): void {
    this.loader.invalidate();
  }

  stop(): void {
    this.loader.stop();
  }
}
