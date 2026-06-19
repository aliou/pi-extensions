/**
 * Minimal accent confirmation gate shown after a docs-drift check.
 *
 * Layout (one stat line, the brief as hero, one hint line):
 *
 *   ╭─ autodocs · docs drift ─────────────────╮
 *   │ abc1234 → def5678 · 3 commits · +142 / -37
 *   │
 *   │ <brief, wrapped>
 *   │
 *   │ y: update docs   n/esc: skip
 *   ╰──────────────────────────────────────────╯
 *
 * y/enter  -> accept (inject a nextTurn suggestion to the main agent)
 * n/esc    -> skip
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
import type { GateResult, GitAdvancement } from "../lib/types";

export class GateDialog implements Component {
  private readonly container = new Container();
  private readonly briefText: Text;

  constructor(
    private readonly theme: Theme,
    advancement: GitAdvancement,
    private readonly brief: string,
    private readonly done: (result: GateResult) => void,
  ) {
    const accent = (s: string) => theme.fg("accent", s);

    this.container.addChild(new DynamicBorder(accent));
    this.container.addChild(
      new Text(theme.fg("accent", theme.bold("autodocs · docs drift")), 1, 0),
    );
    this.container.addChild(new Spacer(1));

    const stat = `${advancement.fromSha} → ${advancement.toSha} · ${advancement.commits} commit${advancement.commits === 1 ? "" : "s"} · +${advancement.additions} / -${advancement.deletions}`;
    this.container.addChild(new Text(theme.fg("muted", stat), 1, 0));
    this.container.addChild(new Spacer(1));

    this.briefText = new Text(
      theme.fg("text", this.brief.trim() || "Docs may need updating."),
      1,
      0,
    );
    this.container.addChild(this.briefText);
    this.container.addChild(new Spacer(1));

    this.container.addChild(
      new Text(theme.fg("dim", "y: update docs   n/esc: skip"), 1, 0),
    );
    this.container.addChild(new DynamicBorder(accent));
  }

  render(width: number): string[] {
    // Re-wrap the brief at render width so long paragraphs fit.
    this.briefText.setText(
      wrapTextWithAnsi(
        this.theme.fg("text", this.brief.trim() || "Docs may need updating."),
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
      this.done("accept");
      return;
    }
    if (matchesKey(data, Key.escape) || data === "n" || data === "N") {
      this.done("skip");
    }
  }
}
