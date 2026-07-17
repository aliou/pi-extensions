import { Panel } from "@aliou/pi-utils-ui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  type Component,
  getKeybindings,
  Text,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { LinesComponent } from "@harness/ui";
import { formatRelativeTime } from "@harness/utils";
import type { QqSessionSummary } from "../context";
import { formatQuestionCount, safeFirstLine } from "../format";

export type QqSessionPickerAction = "resume" | "open";
type Done = (sessionId: string | null) => void;

/**
 * List of qq threads, most-recent first. Reused by the Resume flow and the
 * Display overlay's session list. Each row shows the age of the last
 * question, the question count (when >1), and a preview of the question
 * (`latestQuestion` for Resume, `firstQuestion` for Display).
 */
export class QqSessionPicker implements Component {
  private selectedIndex = 0;
  private maxVisible = 12;

  constructor(
    private readonly sessions: QqSessionSummary[],
    private readonly theme: Theme,
    private readonly action: QqSessionPickerAction,
    private readonly previewMode: "latest" | "first",
    private readonly done: Done,
  ) {}

  handleInput(data: string): void {
    const kb = getKeybindings();

    if (kb.matches(data, "tui.select.up")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      return;
    }
    if (kb.matches(data, "tui.select.down")) {
      this.selectedIndex = Math.min(
        this.sessions.length - 1,
        this.selectedIndex + 1,
      );
      return;
    }
    if (kb.matches(data, "tui.select.pageUp")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - this.maxVisible);
      return;
    }
    if (kb.matches(data, "tui.select.pageDown")) {
      this.selectedIndex = Math.min(
        this.sessions.length - 1,
        this.selectedIndex + this.maxVisible,
      );
      return;
    }
    if (kb.matches(data, "tui.select.confirm")) {
      const item = this.sessions[this.selectedIndex];
      this.done(item?.sessionId ?? null);
      return;
    }
    if (kb.matches(data, "tui.select.cancel")) {
      this.done(null);
    }
  }

  render(width: number): string[] {
    const lines: string[] = [];

    const startIndex = Math.max(
      0,
      Math.min(
        this.selectedIndex - Math.floor(this.maxVisible / 2),
        this.sessions.length - this.maxVisible,
      ),
    );
    const endIndex = Math.min(
      startIndex + this.maxVisible,
      this.sessions.length,
    );

    for (let i = startIndex; i < endIndex; i++) {
      const session = this.sessions[i];
      if (!session) continue;
      lines.push(this.renderRow(session, i === this.selectedIndex, width));
    }

    if (this.sessions.length > this.maxVisible) {
      lines.push(
        this.theme.fg(
          "muted",
          truncateToWidth(
            `  (${this.selectedIndex + 1}/${this.sessions.length})`,
            width,
          ),
        ),
      );
    }

    return new Panel({
      title: "qq history",
      titleStyle: (text) => this.theme.fg("accent", text),
      borderStyle: (text) => this.theme.fg("muted", text),
      border: "round",
      body: new LinesComponent(() => lines),
      footer: new Text(
        this.theme.fg("muted", `↑/↓ select · Enter ${this.action} · Esc back`),
        0,
        0,
      ),
    }).render(width);
  }

  invalidate(): void {}

  private renderRow(
    session: QqSessionSummary,
    selected: boolean,
    width: number,
  ): string {
    const cursor = selected ? this.theme.fg("accent", "  › ") : "    ";
    const age = this.theme.fg("dim", formatRelativeTime(session.updatedAt));

    const narrow = width < 60;
    const count =
      session.questionCount > 1
        ? this.theme.fg(
            "dim",
            formatQuestionCount(session.questionCount, narrow),
          )
        : "";

    const preview =
      this.previewMode === "latest"
        ? session.latestQuestion
        : session.firstQuestion;
    const prompt = safeFirstLine(preview);

    const prefix = [cursor, age, count].filter(Boolean).join("  ");
    const available = Math.max(10, width - visibleWidth(prefix) - 1);
    const line = `${prefix}  ${truncateToWidth(prompt, available, "…")}`;

    if (selected) {
      return this.theme.bg(
        "selectedBg",
        truncateToWidth(line, width, "", true),
      );
    }
    return truncateToWidth(line, width, "", true);
  }
}
