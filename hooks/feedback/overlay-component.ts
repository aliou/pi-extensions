import { DataTable, Panel, Stack, type TableColumn } from "@aliou/pi-utils-ui";
import {
  getMarkdownTheme,
  type Theme,
  type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import {
  type Component,
  Input,
  Key,
  Markdown,
  type MarkdownTheme,
  matchesKey,
  type TUI,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { sortFeedbackItems } from "./collect";
import { buildClearRecord, buildFeedbackRecord } from "./persistence";
import type { Transcript } from "./transcript";
import {
  type FeedbackItem,
  type FeedbackRating,
  type FeedbackSnapshot,
  type FeedbackSortMode,
  RATING_LABELS,
} from "./types";

type View = "list" | "detail" | "comment";
type TableRow = FeedbackItem & { selected: boolean };

export interface FeedbackOverlayOptions {
  snapshot: FeedbackSnapshot;
  tui: TUI;
  theme: Theme;
  readTranscript: (item: FeedbackItem) => Transcript | undefined;
  onSubmit: (
    item: FeedbackItem,
    rating: FeedbackRating | undefined,
    comment?: string,
  ) => void;
  onClose: () => void;
}

const RATING_BY_KEY: Record<string, FeedbackRating> = {
  "1": "bad",
  "2": "ok",
  "3": "good",
};

const RATING_THEME_COLOR: Record<FeedbackRating, ThemeColor> = {
  bad: "error",
  ok: "warning",
  good: "success",
};

const SORT_CYCLE: FeedbackSortMode[] = ["status", "recent", "name"];
const SORT_LABEL: Record<FeedbackSortMode, string> = {
  status: "status",
  recent: "recent",
  name: "name",
};
const MIN_OVERLAY_WIDTH = 60;
const MIN_OVERLAY_HEIGHT = 12;
const MAX_TRANSCRIPT_LINES = 1000;

/**
 * Floating overlay for rating subagent runs. List -> detail -> comment.
 *
 * Snapshot-on-open: items are copied from the snapshot and mutated in place
 * after a submit/clear (so re-sorting keeps the new state). Tokens are loaded
 * eagerly from each subagent's transcript on construction.
 */
export class FeedbackOverlayComponent implements Component {
  private items: FeedbackItem[];
  private view: View = "list";
  private sortMode: FeedbackSortMode = "status";
  private selectedIndex = 0;
  private detailScroll = 0;
  private pendingRating: FeedbackRating | null = null;
  private readonly commentInput = new Input();
  private readonly transcriptCache = new Map<string, Transcript | undefined>();
  private readonly markdownTheme: MarkdownTheme;
  private disposed = false;

  constructor(private readonly opts: FeedbackOverlayOptions) {
    this.items = sortFeedbackItems(opts.snapshot.items, this.sortMode);
    this.markdownTheme = getMarkdownTheme();
    this.configureCommentInput();
    this.preloadTranscripts();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  render(width: number): string[] {
    const tooSmall =
      width < MIN_OVERLAY_WIDTH ||
      (this.opts.tui.terminal.rows ?? 24) < MIN_OVERLAY_HEIGHT;

    return new Panel({
      title: this.renderTitle(),
      body: tooSmall ? this.buildTooSmallBody() : this.buildBody(),
      footer: this.buildFooter(),
      border: "round",
      padding: 0,
      borderStyle: (text) => this.opts.theme.fg("dim", text),
      titleStyle: (text) =>
        this.opts.theme.fg("accent", this.opts.theme.bold(text)),
    }).render(width);
  }

  handleInput(data: string): void {
    if (this.view === "comment") {
      this.commentInput.handleInput(data);
      this.opts.tui.requestRender();
      return;
    }

    if (this.view === "detail") {
      this.handleDetailInput(data);
      this.opts.tui.requestRender();
      return;
    }

    this.handleListInput(data);
    this.opts.tui.requestRender();
  }

  invalidate(): void {}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
  }

  // ── List view ────────────────────────────────────────────────────────────

  private handleListInput(data: string): void {
    if (this.items.length === 0) {
      if (data === "q" || data === "Q") this.close();
      return;
    }

    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.close();
      return;
    }

    if (matchesKey(data, Key.down) || data === "j") {
      this.moveSelection(1);
    } else if (matchesKey(data, Key.up) || data === "k") {
      this.moveSelection(-1);
    } else if (matchesKey(data, Key.enter)) {
      this.openDetail();
    } else if (matchesKey(data, Key.left) || data === "h") {
      this.moveSelection(-1);
    } else if (matchesKey(data, Key.right) || data === "l") {
      this.moveSelection(1);
    } else if (data === "s" || data === "S") {
      this.cycleSort();
    } else if (data === "q" || data === "Q") {
      this.close();
    }
  }

  /** Move selection with wrap-around (loop). */
  private moveSelection(delta: number): void {
    if (this.items.length === 0) return;
    this.selectedIndex =
      (this.selectedIndex + delta + this.items.length) % this.items.length;
  }

  private cycleSort(): void {
    const idx = SORT_CYCLE.indexOf(this.sortMode);
    const next = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    if (next) this.sortMode = next;
    // Re-sort from the (possibly mutated) in-memory items so freshly
    // submitted ratings/clears are preserved across a re-sort.
    this.items = sortFeedbackItems(this.items, this.sortMode);
    this.selectedIndex = Math.min(this.selectedIndex, this.items.length - 1);
  }

  private openDetail(): void {
    this.detailScroll = 0;
    this.view = "detail";
  }

  // ── Detail view ─────────────────────────────────────────────────────────

  private handleDetailInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.view = "list";
      return;
    }

    if (RATING_BY_KEY[data]) {
      this.startComment(RATING_BY_KEY[data]);
      return;
    }

    if (data === "c" || data === "C") {
      this.clearRating();
      return;
    }

    // Navigation between subagent sessions with arrow keys.
    if (matchesKey(data, Key.left) || data === "h") {
      this.moveSelection(-1);
      this.detailScroll = 0;
      return;
    }
    if (matchesKey(data, Key.right) || data === "l") {
      this.moveSelection(1);
      this.detailScroll = 0;
      return;
    }

    // Scrolling: j = down (later content), k = up (earlier content).
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

  private startComment(rating: FeedbackRating): void {
    this.pendingRating = rating;
    this.commentInput.setValue("");
    this.view = "comment";
  }

  private configureCommentInput(): void {
    this.commentInput.onSubmit = (value: string) => {
      if (this.pendingRating) {
        this.submitRating(this.pendingRating, value);
      }
    };
    this.commentInput.onEscape = () => {
      // Discard the pending rating and return to the detail view.
      this.pendingRating = null;
      this.view = "detail";
    };
  }

  private submitRating(rating: FeedbackRating, comment?: string): void {
    const item = this.items[this.selectedIndex];
    if (!item || !this.pendingRating) return;

    const trimmed = comment?.trim();
    const normalized = trimmed && trimmed.length > 0 ? trimmed : undefined;

    this.opts.onSubmit(item, rating, normalized);

    this.items[this.selectedIndex] = {
      ...item,
      rating,
      comment: normalized,
    };
    this.pendingRating = null;
    this.view = "detail";
  }

  private clearRating(): void {
    const item = this.items[this.selectedIndex];
    if (!item || item.rating === undefined) return;

    this.opts.onSubmit(item, undefined);

    this.items[this.selectedIndex] = {
      ...item,
      rating: undefined,
      comment: undefined,
    };
  }

  // ── Transcripts ─────────────────────────────────────────────────────────

  private preloadTranscripts(): void {
    for (const item of this.items) {
      const transcript = this.opts.readTranscript(item);
      this.transcriptCache.set(item.sessionId, transcript);
      this.applyTranscriptStats(item, transcript);
    }
  }

  private transcriptFor(item: FeedbackItem): Transcript | undefined {
    const cached = this.transcriptCache.get(item.sessionId);
    if (cached !== undefined) return cached;
    const transcript = this.opts.readTranscript(item);
    this.transcriptCache.set(item.sessionId, transcript);
    return transcript;
  }

  private applyTranscriptStats(
    item: FeedbackItem,
    transcript: Transcript | undefined,
  ): void {
    if (!transcript) return;
    if (transcript.outputTokens !== undefined) {
      item.outputTokens = transcript.outputTokens;
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  private renderTitle(): string {
    const total = this.opts.snapshot.total;
    const unrated = this.opts.snapshot.unrated;
    switch (this.view) {
      case "detail":
        return "feedback: detail";
      case "comment":
        return `feedback: rate ${this.pendingRating ?? "?"}`;
      default:
        return `feedback ${unrated}/${total}`;
    }
  }

  private buildTooSmallBody(): Component {
    return new LinesComponent(() => [
      this.opts.theme.fg("warning", "Terminal too small."),
      `Need at least ${MIN_OVERLAY_WIDTH}x${MIN_OVERLAY_HEIGHT}.`,
    ]);
  }

  private buildBody(): Component {
    const body = new Stack({ gap: 0 });
    if (this.view === "comment") {
      body.addChild(this.renderListView());
      body.addChild(this.renderCommentBox());
    } else if (this.view === "list") {
      body.addChild(this.renderListView());
    } else {
      body.addChild(this.renderDetailView());
    }
    return body;
  }

  private renderListView(): Component {
    if (this.items.length === 0) {
      return new LinesComponent(() => [
        this.opts.theme.fg("muted", "No subagent runs in this branch."),
      ]);
    }
    return new LinesComponent((w) => this.renderTable(w));
  }

  /**
   * Responsive table using DataTable. Columns hide automatically on narrow
   * terminals based on priority (model lowest, subagent highest). Flexible
   * columns absorb extra width so the table fills the available space.
   */
  private renderTable(width: number): string[] {
    const t = this.opts.theme;

    const rows: TableRow[] = this.items.map((item, index) => ({
      ...item,
      selected: index === this.selectedIndex,
    }));

    const maxSubagentWidth = Math.max(
      8,
      ...this.items.map((item) => visibleWidth(item.subagentName)),
    );

    const columns: TableColumn<TableRow>[] = [
      {
        key: "subagent",
        header: "subagent",
        width: Math.min(16, maxSubagentWidth),
        priority: 100,
        render: (row) =>
          row.selected
            ? t.fg("accent", row.subagentName)
            : t.fg("text", row.subagentName),
        headerStyle: (text) => t.fg("dim", text),
        cellStyle: (text) => text,
      },
      {
        key: "model",
        header: "model",
        minWidth: 12,
        priority: 95,
        render: (row) => t.fg("dim", row.modelLabel),
        headerStyle: (text) => t.fg("dim", text),
        cellStyle: (text) => text,
      },
      {
        key: "tokens",
        header: "tok",
        width: 5,
        priority: 70,
        align: "right",
        render: (row) =>
          row.outputTokens !== undefined ? String(row.outputTokens) : "—",
        headerStyle: (text) => t.fg("dim", text),
        cellStyle: (text) => t.fg("dim", text),
      },
      {
        key: "rating",
        header: "rate",
        width: 5,
        priority: 80,
        render: (row) =>
          row.rating
            ? t.fg(RATING_THEME_COLOR[row.rating], RATING_LABELS[row.rating])
            : t.fg("dim", "—"),
        headerStyle: (text) => t.fg("dim", text),
        cellStyle: (text) => text,
      },
      {
        key: "age",
        header: "age",
        width: 4,
        priority: 60,
        align: "right",
        render: (row) => ageLabel(row.timestampMs),
        headerStyle: (text) => t.fg("dim", text),
        cellStyle: (text) => t.fg("dim", text),
      },
    ];

    const table = new DataTable<TableRow>({
      columns,
      rows,
      separatorStyle: (text) => t.fg("dim", text),
    });

    return table.render(width);
  }

  private renderCommentBox(): Component {
    const t = this.opts.theme;
    const label = t.fg("accent", `rating: ${this.pendingRating ?? "?"}`);
    const prompt = t.fg("dim", "comment: ");
    return new LinesComponent((w) => {
      const inputLine =
        this.commentInput.render(Math.max(10, w - visibleWidth(prompt)))[0] ??
        "";
      return [
        label,
        `${prompt}${inputLine}`,
        t.fg("dim", "enter submit  esc cancel"),
      ];
    });
  }

  private renderDetailView(): Component {
    const item = this.items[this.selectedIndex];
    const t = this.opts.theme;
    if (!item) {
      return new LinesComponent(() => [t.fg("muted", "No item selected.")]);
    }

    return new LinesComponent((w) => {
      const lines: string[] = [];
      const header = `${t.fg("accent", item.subagentName)}  ${t.fg("dim", item.modelLabel)}  ${t.fg("dim", ageLabel(item.timestampMs))}`;
      lines.push(truncateToWidth(header, w, "", true));

      const transcript = this.transcriptFor(item);
      if (transcript) {
        const stats: string[] = [];
        if (
          transcript.inputTokens !== undefined &&
          transcript.outputTokens !== undefined
        ) {
          stats.push(
            `${transcript.inputTokens}/${transcript.outputTokens} tokens`,
          );
        } else if (transcript.outputTokens !== undefined) {
          stats.push(`${transcript.outputTokens} tokens`);
        }
        if (transcript.toolCalls !== undefined && transcript.toolCalls > 0) {
          stats.push(
            `${transcript.toolCalls} tool call${transcript.toolCalls === 1 ? "" : "s"}`,
          );
        }
        if (transcript.cost !== undefined) {
          stats.push(`$${transcript.cost.toFixed(4)}`);
        }
        if (transcript.durationMs !== undefined) {
          stats.push(formatDuration(transcript.durationMs));
        }
        if (stats.length > 0) {
          lines.push(t.fg("dim", stats.join("  ")));
        }
      }

      if (item.rating) {
        const ratingLine = `${t.fg("dim", "rated:")} ${t.fg(RATING_THEME_COLOR[item.rating], RATING_LABELS[item.rating])}`;
        lines.push(ratingLine);
        if (item.comment) {
          lines.push(
            `${t.fg("dim", "comment:")} ${t.fg("text", item.comment)}`,
          );
        }
      } else {
        lines.push(t.fg("dim", "rated: —"));
      }
      lines.push(t.fg("dim", "─".repeat(w)));

      const available = this.availableDetailLines();
      const body = this.renderTranscriptBody(
        transcript,
        w,
        available,
        this.detailScroll,
      );
      lines.push(...body);
      return lines;
    });
  }

  private renderTranscriptBody(
    transcript: Transcript | undefined,
    width: number,
    available: number,
    scroll: number,
  ): string[] {
    const t = this.opts.theme;
    if (
      !transcript ||
      (!transcript.input && !transcript.output && !transcript.toolResult)
    ) {
      return centeredLines(
        width,
        available,
        t.fg("warning", "Transcript unavailable"),
      );
    }

    const all: string[] = [];
    if (transcript.input) {
      all.push(t.fg("dim", "input"));
      all.push(...this.renderMarkdownBlock(transcript.input, width));
      all.push("");
    }

    // For session_name the value is the tool result, so surface it prominently.
    const item = this.items[this.selectedIndex];
    const toolResult = transcript.toolResult;
    const showToolResult = toolResult && item?.subagentName === "session_name";

    if (showToolResult) {
      all.push(t.fg("dim", "result"));
      all.push(...this.renderMarkdownBlock(toolResult, width));
      if (transcript.output) all.push("");
    }

    if (transcript.output) {
      all.push(t.fg("dim", "output"));
      all.push(...this.renderMarkdownBlock(transcript.output, width));
    }

    const total = all.length;
    const clamped = Math.min(
      Math.max(0, scroll),
      Math.max(0, total - available),
    );
    const end = Math.min(total, clamped + available);
    const slice = all.slice(clamped, end);
    while (slice.length < available) slice.push("");
    return slice;
  }

  /** Render a markdown block with side padding. */
  private renderMarkdownBlock(text: string, width: number): string[] {
    try {
      const md = new Markdown(text, 1, 0, this.markdownTheme);
      return md.render(Math.max(8, width)).slice(0, MAX_TRANSCRIPT_LINES);
    } catch {
      return wrapAndTruncate(text, Math.max(8, width - 2));
    }
  }

  private availableDetailLines(): number {
    const rows = this.opts.tui.terminal.rows ?? 24;
    // Panel chrome (borders/title/footer ~4) + detail header (up to 4).
    const chrome = 4 + 4;
    return Math.max(3, Math.floor(rows * 0.9) - chrome);
  }

  private buildFooter(): Component {
    return new LineComponent((width) => this.renderFooter(width));
  }

  private renderFooter(width: number): string {
    const t = this.opts.theme;
    const dim = (s: string) => t.fg("dim", s);

    let keys: string;
    if (this.view === "comment") {
      keys = `${dim("enter")} submit  ${dim("esc")} cancel`;
    } else if (this.view === "detail") {
      const one = t.fg("error", "1");
      const two = t.fg("warning", "2");
      const three = t.fg("success", "3");
      keys =
        `${one} bad  ${two} okay  ${three} good  ` +
        `${dim("c")} clear  ${dim("h/l")} prev/next  ${dim("j/k")} scroll  ${dim("esc")} back`;
    } else {
      keys =
        `${dim("j/k")} navigate  ${dim("enter")} open  ` +
        `${dim("s")} sort:${t.fg("accent", SORT_LABEL[this.sortMode])}  ${dim("q")} close`;
    }
    return truncateToWidth(keys, width, "", true);
  }

  private close(): void {
    this.dispose();
    this.opts.onClose();
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

function ageLabel(timestampMs: number): string {
  const delta = Date.now() - timestampMs;
  if (delta < 0 || Number.isNaN(delta)) return "?";
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function wrapAndTruncate(text: string, width: number): string[] {
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
  return out.slice(0, MAX_TRANSCRIPT_LINES);
}

function centeredLines(
  width: number,
  height: number,
  content: string,
): string[] {
  const lines = Array.from({ length: Math.max(1, height) }, () => "");
  const row = Math.max(0, Math.floor((lines.length - 1) / 2));
  const leftPad = Math.max(0, Math.floor((width - visibleWidth(content)) / 2));
  lines[row] = truncateToWidth(
    `${" ".repeat(leftPad)}${content}`,
    width,
    "",
    true,
  );
  return lines;
}

// Re-export for the survey driver / tests.
export { buildClearRecord, buildFeedbackRecord };

// ── tiny inline components (same pattern as pi-processes) ────────────────

class LineComponent implements Component {
  constructor(private readonly renderLine: (width: number) => string) {}
  render(width: number): string[] {
    return [this.renderLine(width)];
  }
  invalidate(): void {}
}

class LinesComponent implements Component {
  constructor(private readonly renderLines: (width: number) => string[]) {}
  render(width: number): string[] {
    return this.renderLines(width);
  }
  invalidate(): void {}
}
