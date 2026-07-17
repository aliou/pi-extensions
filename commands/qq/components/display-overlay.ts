import { Panel, Stack } from "@aliou/pi-utils-ui";
import { getMarkdownTheme, type Theme } from "@earendil-works/pi-coding-agent";
import {
  type Component,
  Key,
  Markdown,
  type MarkdownTheme,
  matchesKey,
  type TUI,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { LineComponent, LinesComponent } from "@harness/ui";
import { formatRelativeTime } from "@harness/utils";
import type { QqSessionSummary } from "../context";
import { formatFooter, formatQuestionCount, safeFirstLine } from "../format";

type View =
  | { name: "sessions" }
  | { name: "questions"; session: QqSessionSummary }
  | {
      name: "detail";
      session: QqSessionSummary;
      answerId: string;
      scroll: number;
    };

export interface QqDisplayOverlayOptions {
  sessions: QqSessionSummary[];
  tui: TUI;
  theme: Theme;
  onClose: () => void;
}

const MIN_OVERLAY_WIDTH = 50;
const MIN_OVERLAY_HEIGHT = 12;

/**
 * Browse-only overlay for past qq answers. Three views stacked behind one
 * Panel: sessions → questions (in a thread) → detail (markdown answer).
 * Esc pops one level; Esc from the sessions list closes the overlay. Nothing
 * here mutates the parent session or starts a model call.
 */
export class QqDisplayOverlay implements Component {
  private view: View = { name: "sessions" };
  private sessionIndex = 0;
  private questionIndex = 0;
  private detailScroll = 0;
  private readonly markdownTheme: MarkdownTheme;

  constructor(private readonly opts: QqDisplayOverlayOptions) {
    this.markdownTheme = getMarkdownTheme();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  render(width: number): string[] {
    const tooSmall =
      width < MIN_OVERLAY_WIDTH ||
      (this.opts.tui.terminal.rows ?? 24) < MIN_OVERLAY_HEIGHT;

    return new Panel({
      title: this.renderTitle(),
      body: tooSmall ? this.buildTooSmallBody() : this.buildBody(width),
      footer: new LineComponent((w) => this.renderFooter(w)),
      border: "round",
      padding: 0,
      borderStyle: (text) => this.opts.theme.fg("dim", text),
      titleStyle: (text) => this.opts.theme.fg("accent", text),
    }).render(width);
  }

  handleInput(data: string): void {
    if (this.view.name === "detail") {
      this.handleDetailInput(data);
    } else if (this.view.name === "questions") {
      this.handleQuestionsInput(data);
    } else {
      this.handleSessionsInput(data);
    }
    this.opts.tui.requestRender();
  }

  invalidate(): void {}

  // ── Sessions view ─────────────────────────────────────────────────────────

  private handleSessionsInput(data: string): void {
    const sessions = this.opts.sessions;
    if (sessions.length === 0) {
      if (matchesKey(data, Key.escape)) this.close();
      return;
    }
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.close();
      return;
    }
    if (matchesKey(data, Key.down) || data === "j") this.moveSession(1);
    else if (matchesKey(data, Key.up) || data === "k") this.moveSession(-1);
    else if (matchesKey(data, Key.enter)) this.openQuestions();
    else if (matchesKey(data, Key.left) || data === "h") this.moveSession(-1);
    else if (matchesKey(data, Key.right) || data === "l") this.moveSession(1);
    else if (data === "q" || data === "Q") this.close();
  }

  private moveSession(delta: number): void {
    const n = this.opts.sessions.length;
    if (n === 0) return;
    this.sessionIndex = (this.sessionIndex + delta + n) % n;
  }

  private openQuestions(): void {
    const session = this.opts.sessions[this.sessionIndex];
    if (!session) return;
    this.questionIndex = 0;
    this.detailScroll = 0;
    this.view = { name: "questions", session };
  }

  // ── Questions view ───────────────────────────────────────────────────────

  private handleQuestionsInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.view = { name: "sessions" };
      return;
    }
    const session = this.view.name === "questions" ? this.view.session : null;
    if (!session) return;
    const n = session.answers.length;

    if (matchesKey(data, Key.down) || data === "j") {
      this.questionIndex = Math.min(n - 1, this.questionIndex + 1);
    } else if (matchesKey(data, Key.up) || data === "k") {
      this.questionIndex = Math.max(0, this.questionIndex - 1);
    } else if (matchesKey(data, Key.left) || data === "h") {
      this.questionIndex = Math.max(0, this.questionIndex - 1);
    } else if (matchesKey(data, Key.right) || data === "l") {
      this.questionIndex = Math.min(n - 1, this.questionIndex + 1);
    } else if (matchesKey(data, Key.enter)) {
      const answer = session.answers[this.questionIndex];
      if (answer) {
        this.detailScroll = 0;
        this.view = {
          name: "detail",
          session,
          answerId: answer.id,
          scroll: 0,
        };
      }
    }
  }

  // ── Detail view ───────────────────────────────────────────────────────────

  private handleDetailInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      if (this.view.name === "detail") {
        this.view = { name: "questions", session: this.view.session };
      }
      return;
    }

    // h/l navigate between answers in the same thread.
    if (matchesKey(data, Key.left) || data === "h") {
      this.moveAnswer(-1);
      return;
    }
    if (matchesKey(data, Key.right) || data === "l") {
      this.moveAnswer(1);
      return;
    }

    // Scrolling: j = down (later content), k = up.
    if (matchesKey(data, Key.down) || data === "j") {
      this.detailScroll += 1;
    } else if (matchesKey(data, Key.up) || data === "k") {
      this.detailScroll = Math.max(0, this.detailScroll - 1);
    } else if (data === "g") {
      this.detailScroll = 0;
    } else if (data === "G") {
      this.detailScroll = Number.POSITIVE_INFINITY;
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  /** Move to a neighboring answer within the current thread (h/l). No-op at
   * the ends so the detail view stays put instead of wrapping. */
  private moveAnswer(delta: number): void {
    if (this.view.name !== "detail") return;
    const view = this.view;
    const idx = view.session.answers.findIndex((a) => a.id === view.answerId);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= view.session.answers.length)
      return;
    const target = view.session.answers[targetIdx];
    if (!target) return;
    this.detailScroll = 0;
    this.view = {
      name: "detail",
      session: view.session,
      answerId: target.id,
      scroll: 0,
    };
  }

  private renderTitle(): string {
    if (this.view.name === "detail") {
      return `qq answer`;
    }
    if (this.view.name === "questions") {
      const preview = safeFirstLine(this.view.session.firstQuestion);
      const truncated = truncateToWidth(preview, 30, "…");
      return `qq / ${truncated}`;
    }
    return `qq history`;
  }

  private buildTooSmallBody(): Component {
    const t = this.opts.theme;
    return new LinesComponent(() => [
      t.fg("warning", "Terminal too small for qq history."),
      `Need at least ${MIN_OVERLAY_WIDTH}x${MIN_OVERLAY_HEIGHT}.`,
      t.fg("dim", "Esc close"),
    ]);
  }

  private buildBody(width: number): Component {
    const body = new Stack({ gap: 0 });
    if (this.view.name === "sessions") {
      body.addChild(this.renderSessionsBody(width));
    } else if (this.view.name === "questions") {
      body.addChild(this.renderQuestionsBody(this.view.session, width));
    } else {
      body.addChild(this.renderDetailBody(this.view, width));
    }
    return body;
  }

  private renderSessionsBody(_width: number): Component {
    const t = this.opts.theme;
    const sessions = this.opts.sessions;
    if (sessions.length === 0) {
      return new LinesComponent(() => [
        t.fg("muted", "No qq history yet."),
        t.fg("dim", "Ask one with /qq <question>."),
      ]);
    }
    return new LinesComponent((w) => this.renderSessionRows(sessions, w));
  }

  private renderSessionRows(
    sessions: QqSessionSummary[],
    width: number,
  ): string[] {
    const t = this.opts.theme;
    const maxVisible = 12;
    const start = Math.max(
      0,
      Math.min(
        this.sessionIndex - Math.floor(maxVisible / 2),
        sessions.length - maxVisible,
      ),
    );
    const end = Math.min(start + maxVisible, sessions.length);

    const lines: string[] = [];
    for (let i = start; i < end; i++) {
      const session = sessions[i];
      if (!session) continue;
      const selected = i === this.sessionIndex;
      const cursor = selected ? t.fg("accent", "  › ") : "    ";
      const age = t.fg("dim", formatRelativeTime(session.updatedAt));
      const narrow = width < 60;
      const count =
        session.questionCount > 1
          ? t.fg("dim", formatQuestionCount(session.questionCount, narrow))
          : "";
      const preview = safeFirstLine(session.firstQuestion);
      const prefix = [cursor, age, count].filter(Boolean).join("  ");
      const available = Math.max(10, width - visibleWidth(prefix) - 1);
      const line = `${prefix}  ${truncateToWidth(preview, available, "…")}`;
      lines.push(
        selected
          ? t.bg("selectedBg", truncateToWidth(line, width, "", true))
          : truncateToWidth(line, width, "", true),
      );
    }
    return lines;
  }

  private renderQuestionsBody(
    session: QqSessionSummary,
    width: number,
  ): Component {
    const t = this.opts.theme;
    const answers = session.answers;
    const lines: string[] = [];
    const maxVisible = 12;
    const start = Math.max(
      0,
      Math.min(
        this.questionIndex - Math.floor(maxVisible / 2),
        answers.length - maxVisible,
      ),
    );
    const end = Math.min(start + maxVisible, answers.length);

    for (let i = start; i < end; i++) {
      const answer = answers[i];
      if (!answer) continue;
      const selected = i === this.questionIndex;
      const cursor = selected ? t.fg("accent", "  › ") : "    ";
      const age = t.fg("dim", formatRelativeTime(answer.createdAt));
      const preview = safeFirstLine(answer.question);
      const prefix = `${cursor}${age}`;
      const available = Math.max(10, width - visibleWidth(prefix) - 1);
      const line = `${prefix}  ${truncateToWidth(preview, available, "…")}`;
      lines.push(
        selected
          ? t.bg("selectedBg", truncateToWidth(line, width, "", true))
          : truncateToWidth(line, width, "", true),
      );
    }
    return new LinesComponent(() => lines);
  }

  private renderDetailBody(
    view: Extract<View, { name: "detail" }>,
    _width: number,
  ): Component {
    const t = this.opts.theme;
    const answer = view.session.answers.find((a) => a.id === view.answerId);
    if (!answer) {
      return new LinesComponent(() => [t.fg("muted", "No answer selected.")]);
    }

    return new LinesComponent((w) => {
      const lines: string[] = [];
      const contentWidth = Math.max(8, w - 2);

      // Question
      lines.push(t.fg("accent", "\x1b[1mQuestion\x1b[22m"));
      lines.push(...wrapPlain(answer.question, contentWidth));
      lines.push("");

      // Answer (markdown)
      lines.push(t.fg("accent", "\x1b[1mAnswer\x1b[22m"));
      try {
        const md = new Markdown(answer.answer, 1, 0, this.markdownTheme);
        lines.push(...md.render(contentWidth));
      } catch {
        lines.push(...wrapPlain(answer.answer, contentWidth));
      }

      // Footer: model/usage + age
      lines.push("");
      lines.push(t.fg("dim", "─".repeat(contentWidth)));
      const footerParts = [
        formatFooter(answer),
        formatRelativeTime(answer.createdAt),
      ];
      lines.push(
        t.fg("dim", truncateToWidth(footerParts.join("  ·  "), contentWidth)),
      );

      return this.scrollInto(lines, this.detailScroll);
    });
  }

  private scrollInto(lines: string[], scroll: number): string[] {
    const available = this.availableDetailLines();
    const total = lines.length;
    const clamped = Math.min(
      Math.max(0, scroll),
      Math.max(0, total - available),
    );
    const end = Math.min(total, clamped + available);
    const slice = lines.slice(clamped, end);
    while (slice.length < available) slice.push("");
    return slice;
  }

  private availableDetailLines(): number {
    const rows = this.opts.tui.terminal.rows ?? 24;
    // Panel chrome (borders/title/footer ~4) + detail header (question+labels ~4).
    const chrome = 4 + 4;
    return Math.max(3, Math.floor(rows * 0.9) - chrome);
  }

  private renderFooter(width: number): string {
    const t = this.opts.theme;
    const dim = (s: string) => t.fg("dim", s);
    let keys: string;
    if (this.view.name === "detail") {
      keys = `${dim("h/l")} prev/next answer  ${dim("j/k")} scroll  ${dim("g/G")} top/bottom  ${dim("esc")} back`;
    } else if (this.view.name === "questions") {
      keys = `${dim("j/k")} navigate  ${dim("enter")} view  ${dim("esc")} back`;
    } else {
      keys = `${dim("j/k")} navigate  ${dim("enter")} open  ${dim("esc/q")} close`;
    }
    return truncateToWidth(keys, width, "", true);
  }

  private close(): void {
    this.opts.onClose();
  }
}

/** Wrap plain text (the question) to a width, no markdown. */
function wrapPlain(text: string, width: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const para of normalized) {
    if (para === "") {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const word of words) {
      if (visibleWidth(line) === 0) {
        line = word;
      } else if (visibleWidth(`${line} ${word}`) <= width) {
        line = `${line} ${word}`;
      } else {
        out.push(truncateToWidth(line, width, ""));
        line = word;
      }
    }
    if (line) out.push(truncateToWidth(line, width, ""));
  }
  return out;
}
