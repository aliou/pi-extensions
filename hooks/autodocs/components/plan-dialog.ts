/**
 * Plan confirmation dialog shown by /docs:update and /docs:setup.
 *
 * Lists the planned doc targets with an op glyph, plus the brief, then asks
 * to apply or cancel.
 *
 *   ╭─ autodocs · 3 planned changes ────────────╮
 *   │ + docs/extensions/foo.md   new            │
 *   │ ~ docs/getting-started.md  update         │
 *   │ - docs/old.md              archive         │
 *   │                                            │
 *   │ <brief, wrapped>                           │
 *   │                                            │
 *   │ y: apply   n/esc: cancel                   │
 *   ╰────────────────────────────────────────────╯
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import {
  Container,
  Key,
  matchesKey,
  Spacer,
  Text,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import type { DocsTarget, PlanResult } from "../lib/types";

const OP_GLYPH: Record<DocsTarget["op"], string> = {
  create: "+",
  update: "~",
  archive: "-",
};

const OP_LABEL: Record<DocsTarget["op"], string> = {
  create: "new",
  update: "update",
  archive: "archive",
};

export class PlanDialog implements Component {
  private readonly container = new Container();
  private readonly briefText: Text;

  constructor(
    private readonly theme: Theme,
    targets: DocsTarget[],
    private readonly brief: string,
    private readonly done: (result: PlanResult) => void,
  ) {
    const accent = (s: string) => theme.fg("accent", s);

    this.container.addChild(new DynamicBorder(accent));
    this.container.addChild(
      new Text(
        theme.fg(
          "accent",
          theme.bold(
            `autodocs · ${targets.length} planned change${targets.length === 1 ? "" : "s"}`,
          ),
        ),
        1,
        0,
      ),
    );
    this.container.addChild(new Spacer(1));

    for (const t of targets) {
      const glyph = OP_GLYPH[t.op];
      const glyphColor =
        t.op === "create"
          ? theme.fg("toolDiffAdded", glyph)
          : t.op === "archive"
            ? theme.fg("toolDiffRemoved", glyph)
            : theme.fg("muted", glyph);
      this.container.addChild(
        new Text(
          `${glyphColor} ${theme.fg("text", t.path)}   ${theme.fg("dim", OP_LABEL[t.op])}`,
          1,
          0,
        ),
      );
    }
    this.container.addChild(new Spacer(1));

    this.briefText = new Text(
      theme.fg("text", this.brief.trim() || "Docs drift detected."),
      1,
      0,
    );
    this.container.addChild(this.briefText);
    this.container.addChild(new Spacer(1));

    this.container.addChild(
      new Text(theme.fg("dim", "y: apply   n/esc: cancel"), 1, 0),
    );
    this.container.addChild(new DynamicBorder(accent));
  }

  render(width: number): string[] {
    this.briefText.setText(
      wrapTextWithAnsi(
        this.theme.fg("text", this.brief.trim() || "Docs drift detected."),
        width - 2,
      ).join("\n"),
    );
    return this.container.render(width);
  }

  invalidate(): void {
    this.container.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.enter) || data === "y" || data === "Y") {
      this.done("apply");
      return;
    }
    if (matchesKey(data, Key.escape) || data === "n" || data === "N") {
      this.done("cancel");
    }
  }
}
