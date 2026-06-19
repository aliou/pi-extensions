import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  type Component,
  matchesKey,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

export type UpdateStatus = "success" | "error" | "aborted";

/** Max output lines shown in the result panel. Older lines are dropped. */
const MAX_LINES = 30;

/**
 * Compact bordered panel showing the result of `pi update --all`.
 *
 * Renders only as many lines as the content needs (no full-height padding):
 * a top border, a status title, the captured output (wrapped to width, tailed
 * to MAX_LINES), a key hint footer, and a bottom border. Closes on q / Escape.
 */
export class UpdateResultPanel implements Component {
  private readonly theme: Theme;
  private readonly onClose: () => void;
  private readonly status: UpdateStatus;
  private readonly exitCode: number | null;
  private readonly output: string;

  private cachedLines: string[] | null = null;
  private cachedWidth = 0;

  constructor(
    theme: Theme,
    status: UpdateStatus,
    exitCode: number | null,
    output: string,
    onClose: () => void,
  ) {
    this.theme = theme;
    this.status = status;
    this.exitCode = exitCode;
    this.output = output;
    this.onClose = onClose;
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "escape") || data === "q") {
      this.onClose();
      return true;
    }
    return false;
  }

  invalidate(): void {
    this.cachedLines = null;
  }

  private title(): string {
    switch (this.status) {
      case "success":
        return this.theme.fg(
          "success",
          this.theme.bold("[ok] pi update complete"),
        );
      case "error":
        return this.theme.fg(
          "error",
          this.theme.bold(
            `[fail] pi update failed (exit ${this.exitCode ?? "?"})`,
          ),
        );
      case "aborted":
        return this.theme.fg(
          "warning",
          this.theme.bold("[aborted] pi update was cancelled"),
        );
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const contentWidth = Math.max(1, width - 2);
    const border = this.theme.fg("border", "─".repeat(width));

    const wrapped: string[] = [];
    for (const line of (this.output || "").split(/\r?\n/)) {
      for (const w of wrapTextWithAnsi(line || " ", contentWidth)) {
        wrapped.push(w);
      }
    }
    const visible =
      wrapped.length > MAX_LINES
        ? wrapped.slice(wrapped.length - MAX_LINES)
        : wrapped;

    const out: string[] = [border, ` ${this.title()}`];
    if (visible.length === 0) {
      out.push(this.theme.fg("dim", " (no output)"));
    } else {
      for (const line of visible) out.push(` ${line}`);
    }
    const footer =
      this.status === "success"
        ? " q / Esc close"
        : this.status === "aborted"
          ? " q / Esc to close (update aborted)"
          : " q / Esc to close (update failed)";
    out.push(this.theme.fg("dim", footer));

    // Right-align nothing; keep footer left-aligned and within width.
    const last = out[out.length - 1] ?? "";
    if (visibleWidth(last) > width) {
      out[out.length - 1] = last.slice(0, width);
    }

    out.push(border);

    this.cachedWidth = width;
    this.cachedLines = out;
    return out;
  }
}
