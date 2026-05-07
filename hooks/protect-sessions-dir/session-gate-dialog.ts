/**
 * Session gate confirmation dialog.
 *
 * A TUI Component that asks the user to confirm or deny
 * direct access to session files.
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
import type { SessionGateResult } from "./types";

export class SessionGateDialog implements Component {
  private readonly container = new Container();
  private readonly targetText: Text;

  constructor(
    private readonly theme: Theme,
    description: string,
    private readonly target: string,
    private readonly ambiguous: boolean,
    private readonly done: (result: SessionGateResult) => void,
  ) {
    const warnBorder = (s: string) => theme.fg("warning", s);
    const hintText = ambiguous
      ? "y/enter: allow once | a: allow all session access | n/esc: deny"
      : "y/enter: allow once | p: allow this directory for session | a: allow all session access | n/esc: deny";

    this.container.addChild(new DynamicBorder(warnBorder));
    this.container.addChild(
      new Text(theme.fg("warning", theme.bold("Session File Access")), 1, 0),
    );
    this.container.addChild(new Spacer(1));
    this.container.addChild(
      new Text(
        theme.fg("text", `The agent is trying to ${description}.`),
        1,
        0,
      ),
    );
    this.container.addChild(new Spacer(1));

    this.container.addChild(
      new DynamicBorder((s: string) => theme.fg("muted", s)),
    );
    this.targetText = new Text("", 1, 0);
    this.container.addChild(this.targetText);
    this.container.addChild(
      new DynamicBorder((s: string) => theme.fg("muted", s)),
    );

    this.container.addChild(new Spacer(1));
    this.container.addChild(
      new Text(
        theme.fg("muted", "Prefer find_sessions + read_session instead."),
        1,
        0,
      ),
    );
    this.container.addChild(new Spacer(1));
    this.container.addChild(new Text(theme.fg("dim", hintText), 1, 0));
    this.container.addChild(new DynamicBorder(warnBorder));
  }

  render(width: number): string[] {
    this.targetText.setText(
      wrapTextWithAnsi(this.theme.fg("text", this.target), width - 4).join(
        "\n",
      ),
    );
    return this.container.render(width);
  }

  invalidate(): void {
    this.container.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.enter) || data === "y" || data === "Y") {
      this.done("allow-once");
      return;
    }
    if (!this.ambiguous && (data === "p" || data === "P")) {
      this.done("allow-path");
      return;
    }
    if (data === "a" || data === "A") {
      this.done("allow-all");
      return;
    }
    if (matchesKey(data, Key.escape) || data === "n" || data === "N") {
      this.done("deny");
    }
  }
}
