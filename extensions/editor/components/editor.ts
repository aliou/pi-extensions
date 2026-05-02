import type { BorderBand, BorderSlot, ModeColor } from "@harness/events";
import {
  CustomEditor,
  type Theme,
  type ThemeColor,
} from "@mariozechner/pi-coding-agent";

const ESC = "\u001b";
const RESET = "\u001b[0m";

type BorderScroll = {
  top?: number;
  bottom?: number;
};

type ColorFn = (text: string) => string;

export type SlotState = {
  text: string;
  color?: ModeColor;
};

export type ResolvedBorderDecorations = {
  slots: Partial<Record<BorderSlot, SlotState>>;
  bands: Partial<Record<BorderBand, ModeColor>>;
};

export class BorderEditor extends CustomEditor {
  public appTheme?: Theme;
  public getDecorations?: () => ResolvedBorderDecorations;
  public onScrollIndicators?: (scroll: BorderScroll) => void;
  public onDraftChanged?: (text: string) => void;
  private lastDraftText = "";

  override render(width: number): string[] {
    const lines = super.render(width);
    if (width < 1 || lines.length === 0) {
      return lines;
    }

    const draftText = this.getText();
    if (draftText !== this.lastDraftText) {
      this.lastDraftText = draftText;
      this.onDraftChanged?.(draftText);
    }

    const decorations = this.getDecorations?.() ?? { slots: {}, bands: {} };
    const topPlain = stripAnsi(lines[0] ?? "");
    const topScroll = parseTopScrollBorder(topPlain);

    let bottomScroll: number | undefined;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const plain = stripAnsi(lines[i] ?? "");
      if (!plain.startsWith("─")) {
        continue;
      }

      bottomScroll = parseBottomScrollBorder(plain);
      lines[i] = this.buildBottomBorder(width, decorations);
      break;
    }

    lines[0] = this.buildTopBorder(width, decorations);
    this.onScrollIndicators?.({ top: topScroll, bottom: bottomScroll });

    return lines;
  }

  requestRenderNow(): void {
    this.tui.requestRender();
  }

  private buildTopBorder(
    width: number,
    decorations: ResolvedBorderDecorations,
  ): string {
    const topStart = decorations.slots["top-start"];
    const topEnd = decorations.slots["top-end"];

    const left = topStart?.text ? `── ${topStart.text} ` : "";
    const right = topEnd?.text ?? "";

    return buildBorderLine({
      width,
      left,
      right,
      leftColor: this.resolveColor(
        topStart?.color ?? decorations.bands.top,
        (text) => this.resolveBandColor("top", text),
      ),
      rightColor: this.resolveColor(
        topEnd?.color ?? decorations.bands.top,
        (text) => this.resolveBandColor("top", text),
      ),
      frameColor: (text) => this.resolveBandColor("top", text),
    });
  }

  private buildBottomBorder(
    width: number,
    decorations: ResolvedBorderDecorations,
  ): string {
    const bottomStart = decorations.slots["bottom-start"];
    const bottomEnd = decorations.slots["bottom-end"];

    const right = bottomEnd?.text ?? "";

    return buildBorderLine({
      width,
      left: bottomStart?.text ?? "",
      right,
      leftColor: this.resolveColor(
        bottomStart?.color ?? decorations.bands.bottom,
        (text) => this.resolveBandColor("bottom", text),
      ),
      rightColor: this.resolveColor(
        bottomEnd?.color ?? decorations.bands.bottom,
        (text) => this.resolveBandColor("bottom", text),
      ),
      frameColor: (text) => this.resolveBandColor("bottom", text),
    });
  }

  private resolveBandColor(band: BorderBand, text: string): string {
    const decorations = this.getDecorations?.();
    const bandColor = decorations?.bands[band];
    if (!bandColor) {
      return this.borderColor(text);
    }

    return this.resolveColor(bandColor, (fallbackText) =>
      this.borderColor(fallbackText),
    )(text);
  }

  private resolveColor(
    color: ModeColor | undefined,
    fallback: ColorFn,
  ): ColorFn {
    if (!color) {
      return fallback;
    }

    if (color.source === "raw") {
      const hex = color.color;
      if (hex.startsWith("#") && (hex.length === 7 || hex.length === 4)) {
        const r = Number.parseInt(hex.slice(1, 3), 16);
        const g = Number.parseInt(hex.slice(3, 5), 16);
        const b = Number.parseInt(hex.slice(5, 7), 16);
        const prefix = `${ESC}[38;2;${r};${g};${b}m`;
        return (text: string) => `${prefix}${text}${RESET}`;
      }
      return (text: string) => `${hex}${text}${RESET}`;
    }

    return (text: string) =>
      this.appTheme?.fg(color.color as ThemeColor, text) ?? fallback(text);
  }
}

function buildBorderLine(options: {
  width: number;
  left: string;
  right: string;
  leftColor: ColorFn;
  rightColor: ColorFn;
  frameColor: ColorFn;
}): string {
  const width = options.width;
  if (width <= 0) {
    return "";
  }

  const right = trimStartToWidth(options.right, width);
  const maxLeft = Math.max(0, width - right.length);
  const left = trimEndToWidth(options.left, maxLeft);
  const fill = "─".repeat(Math.max(0, width - left.length - right.length));

  const parts: string[] = [];
  if (left.length > 0) {
    parts.push(options.leftColor(left));
  }
  if (fill.length > 0) {
    parts.push(options.frameColor(fill));
  }
  if (right.length > 0) {
    parts.push(options.rightColor(right));
  }

  return parts.join("");
}

function trimEndToWidth(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  return value.length > width ? value.slice(0, width) : value;
}

function trimStartToWidth(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  return value.length > width ? value.slice(value.length - width) : value;
}

function parseTopScrollBorder(line: string): number | undefined {
  const match = line.match(/↑ (\d+) more/);
  if (!match) {
    return undefined;
  }

  return Number.parseInt(match[1] ?? "0", 10);
}

function parseBottomScrollBorder(line: string): number | undefined {
  const match = line.match(/↓ (\d+) more/);
  if (!match) {
    return undefined;
  }

  return Number.parseInt(match[1] ?? "0", 10);
}

function stripAnsi(value: string): string {
  let result = "";

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== ESC) {
      result += char;
      continue;
    }

    if (value[i + 1] !== "[") {
      continue;
    }

    i += 2;
    while (i < value.length && value[i] !== "m") {
      i += 1;
    }
  }

  return result;
}
