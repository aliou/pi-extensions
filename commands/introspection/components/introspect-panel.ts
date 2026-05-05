import type { Theme } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import type { Component, TUI } from "@mariozechner/pi-tui";
import {
  Key,
  Markdown,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";

interface ToolInfo {
  name: string;
  description: string;
  sourceInfo: {
    source: string;
    path: string;
  };
}

interface SlashCommandInfo {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
  sourceInfo: {
    path: string;
  };
}

export interface IntrospectSnapshot {
  systemPrompt: string;
  activeTools: string[];
  allTools: ToolInfo[];
  skills: SlashCommandInfo[];
  prompts: SlashCommandInfo[];
}

interface Tab {
  label: string;
  buildContent: (width: number, theme: Theme) => string[];
}

const MAX_VISIBLE = 14;

export class IntrospectPanel implements Component {
  private theme: Theme;
  private tui: TUI;
  private onClose: () => void;
  private tabs: Tab[];
  private activeTab = 0;
  private scrollOffset = 0;
  private cachedLines: string[] | null = null;
  private cachedTab = -1;
  private cachedWidth = -1;

  constructor(
    tui: TUI,
    theme: Theme,
    snapshot: IntrospectSnapshot,
    onClose: () => void,
  ) {
    this.tui = tui;
    this.theme = theme;
    this.onClose = onClose;

    const cleanPrompt = stripSkillsFromSystemPrompt(snapshot.systemPrompt);

    this.tabs = [
      {
        label: `System (${cleanPrompt.length.toLocaleString()})`,
        buildContent: (w, t) => buildSystemContent(w, t, cleanPrompt),
      },
      {
        label: `Tools (${snapshot.allTools.length})`,
        buildContent: (w, t) => buildToolsContent(w, t, snapshot),
      },
      {
        label: `Skills (${snapshot.skills.length})`,
        buildContent: (w, t) => buildSkillsContent(w, t, snapshot),
      },
      {
        label: `Prompts (${snapshot.prompts.length})`,
        buildContent: (w, t) => buildPromptsContent(w, t, snapshot),
      },
    ];
  }

  invalidate(): void {
    this.cachedLines = null;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || data === "q") {
      this.onClose();
      return;
    }

    if (matchesKey(data, Key.tab)) {
      this.activeTab = (this.activeTab + 1) % this.tabs.length;
      this.scrollOffset = 0;
      this.cachedLines = null;
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.shift("tab"))) {
      this.activeTab =
        (this.activeTab - 1 + this.tabs.length) % this.tabs.length;
      this.scrollOffset = 0;
      this.cachedLines = null;
      this.tui.requestRender();
      return;
    }

    const totalLines = this.cachedLines?.length ?? 0;
    const maxScroll = Math.max(0, totalLines - MAX_VISIBLE);

    if (data === "j" || matchesKey(data, Key.down)) {
      if (this.scrollOffset < maxScroll) {
        this.scrollOffset++;
        this.tui.requestRender();
      }
      return;
    }

    if (data === "k" || matchesKey(data, Key.up)) {
      if (this.scrollOffset > 0) {
        this.scrollOffset--;
        this.tui.requestRender();
      }
      return;
    }

    if (data === " " || matchesKey(data, Key.pageDown)) {
      this.scrollOffset = Math.min(this.scrollOffset + MAX_VISIBLE, maxScroll);
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, Key.pageUp)) {
      this.scrollOffset = Math.max(0, this.scrollOffset - MAX_VISIBLE);
      this.tui.requestRender();
      return;
    }

    if (data === "g") {
      this.scrollOffset = 0;
      this.tui.requestRender();
      return;
    }

    if (data === "G") {
      this.scrollOffset = maxScroll;
      this.tui.requestRender();
      return;
    }
  }

  render(width: number): string[] {
    const t = this.theme;
    const contentWidth = width - 4; // │ + space + ... + space + │

    // Rebuild content cache when tab or width changes
    if (
      !this.cachedLines ||
      this.cachedTab !== this.activeTab ||
      this.cachedWidth !== contentWidth
    ) {
      const tab = this.tabs[this.activeTab];
      const raw = tab ? tab.buildContent(contentWidth, t) : [];
      // Flatten: split any lines containing \n and ensure no embedded newlines
      this.cachedLines = raw.flatMap((line) => line.split("\n"));
      this.cachedTab = this.activeTab;
      this.cachedWidth = contentWidth;
    }

    const totalLines = this.cachedLines.length;
    const maxScroll = Math.max(0, totalLines - MAX_VISIBLE);
    if (this.scrollOffset > maxScroll) this.scrollOffset = maxScroll;

    const lines: string[] = [];

    // Top border with title
    const titleText = " Introspect ";
    const titleLen = visibleWidth(titleText);
    const topRuleLen = Math.max(1, width - titleLen - 3);
    lines.push(
      t.fg("border", "\u256D\u2500") +
        t.fg("accent", t.bold(titleText)) +
        t.fg("border", "\u2500".repeat(topRuleLen)) +
        t.fg("border", "\u256E"),
    );

    // Tab bar
    lines.push(padLine(t, this.renderTabBar(), width));

    // Empty line
    lines.push(padLine(t, "", width));

    // Scroll-up indicator or empty line
    if (this.scrollOffset > 0) {
      lines.push(
        padLine(
          t,
          t.fg("dim", `\u2191 ${this.scrollOffset} lines above`),
          width,
        ),
      );
    } else {
      lines.push(padLine(t, "", width));
    }

    // Content area (fixed height)
    const end = Math.min(this.scrollOffset + MAX_VISIBLE, totalLines);
    for (let i = this.scrollOffset; i < end; i++) {
      lines.push(padLine(t, this.cachedLines[i] ?? "", width));
    }
    // Pad remaining rows to keep height stable
    const shown = end - this.scrollOffset;
    for (let i = shown; i < MAX_VISIBLE; i++) {
      lines.push(padLine(t, "", width));
    }

    // Scroll-down indicator or empty line
    const remaining = totalLines - this.scrollOffset - MAX_VISIBLE;
    if (remaining > 0) {
      lines.push(
        padLine(t, t.fg("dim", `\u2193 ${remaining} lines below`), width),
      );
    } else {
      lines.push(padLine(t, "", width));
    }

    // Separator
    lines.push(
      t.fg("border", "\u251C") +
        t.fg("border", "\u2500".repeat(Math.max(1, width - 2))) +
        t.fg("border", "\u2524"),
    );

    // Controls
    lines.push(
      padLine(
        t,
        t.fg(
          "dim",
          "Tab/S-Tab switch \u00B7 j/k scroll \u00B7 g/G top/bottom \u00B7 q/Esc close",
        ),
        width,
      ),
    );

    // Bottom border
    lines.push(
      t.fg("border", "\u2570") +
        t.fg("border", "\u2500".repeat(Math.max(1, width - 2))) +
        t.fg("border", "\u256F"),
    );

    return lines;
  }

  private renderTabBar(): string {
    const t = this.theme;
    const parts: string[] = [];

    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i];
      if (!tab) continue;
      const active = i === this.activeTab;

      if (active) {
        parts.push(t.fg("accent", t.bold(` ${tab.label} `)));
      } else {
        parts.push(t.fg("dim", ` ${tab.label} `));
      }

      if (i < this.tabs.length - 1) {
        parts.push(t.fg("borderMuted", "\u2502"));
      }
    }

    return parts.join("");
  }
}

// --- Helpers ---

/**
 * Wrap content in a bordered line: │ content │
 * Matches the ask-user pattern exactly: width-4 content area,
 * 1-space padding inside each border.
 */
function padLine(theme: Theme, content: string, width: number): string {
  const innerWidth = width - 4;
  const truncated = truncateToWidth(content, innerWidth);
  const len = visibleWidth(truncated);
  const padding = Math.max(0, innerWidth - len);
  const paddedLine =
    theme.fg("border", "\u2502") +
    " " +
    truncated +
    " ".repeat(padding) +
    " " +
    theme.fg("border", "\u2502");
  return truncateToWidth(paddedLine, width);
}

// --- Content builders ---

function stripSkillsFromSystemPrompt(prompt: string): string {
  // Remove <available_skills>...</available_skills> block
  const xmlStart = prompt.indexOf("\n<available_skills>");
  if (xmlStart !== -1) {
    const xmlEnd = prompt.indexOf("</available_skills>\n");
    if (xmlEnd !== -1) {
      return (
        prompt.slice(0, xmlStart) +
        prompt.slice(xmlEnd + "</available_skills>\n".length)
      );
    }
  }

  // Fallback: remove <skills>...</skills> block
  const skillsStart = prompt.indexOf("\n<skills>");
  if (skillsStart !== -1) {
    const skillsEnd = prompt.indexOf("</skills>\n");
    if (skillsEnd !== -1) {
      return (
        prompt.slice(0, skillsStart) +
        prompt.slice(skillsEnd + "</skills>\n".length)
      );
    }
  }

  return prompt;
}

function buildSystemContent(
  width: number,
  _theme: Theme,
  prompt: string,
): string[] {
  const lines: string[] = [];

  try {
    const mdTheme = getMarkdownTheme();
    const md = new Markdown(prompt, 0, 0, mdTheme);
    lines.push(...md.render(width));
  } catch {
    lines.push(...prompt.split("\n"));
  }

  return lines;
}

function buildToolsContent(
  width: number,
  _theme: Theme,
  snapshot: IntrospectSnapshot,
): string[] {
  if (snapshot.allTools.length === 0) {
    return [_theme.fg("dim", "No tools registered")];
  }

  const activeSet = new Set(snapshot.activeTools);

  // Sort: builtin first, then rest, each group alphabetical
  const sorted = [...snapshot.allTools].sort((a, b) => {
    const aBuiltin = a.sourceInfo.source === "builtin" ? 0 : 1;
    const bBuiltin = b.sourceInfo.source === "builtin" ? 0 : 1;
    if (aBuiltin !== bBuiltin) return aBuiltin - bBuiltin;
    return a.name.localeCompare(b.name);
  });

  // Build markdown table
  const mdLines: string[] = [];
  mdLines.push("| Tool | Source | Status |");
  mdLines.push("|------|--------|--------|");
  for (const tool of sorted) {
    const isActive = activeSet.has(tool.name);
    const status = isActive ? "active" : "inactive";
    mdLines.push(
      `| **${tool.name}** | ${tool.sourceInfo.source} | ${status} |`,
    );
  }

  try {
    const mdTheme = getMarkdownTheme();
    const md = new Markdown(mdLines.join("\n"), 0, 0, mdTheme);
    return md.render(width);
  } catch {
    return mdLines;
  }
}

function buildSkillsContent(
  width: number,
  theme: Theme,
  snapshot: IntrospectSnapshot,
): string[] {
  const lines: string[] = [];

  if (snapshot.skills.length === 0) {
    lines.push(theme.fg("dim", "No skills loaded"));
    return lines;
  }

  const sorted = [...snapshot.skills].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const skill of sorted) {
    const name = skill.name.startsWith("skill:")
      ? skill.name.slice(6)
      : skill.name;

    lines.push(theme.bold(name));

    if (skill.description) {
      const wrapped = wrapTextWithAnsi(
        theme.fg("dim", skill.description),
        width,
      );
      lines.push(...wrapped);
    }
  }

  return lines;
}

function buildPromptsContent(
  _width: number,
  theme: Theme,
  snapshot: IntrospectSnapshot,
): string[] {
  const lines: string[] = [];

  if (snapshot.prompts.length === 0) {
    lines.push(theme.fg("dim", "No prompt templates loaded"));
    return lines;
  }

  const sorted = [...snapshot.prompts].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const prompt of sorted) {
    lines.push(theme.bold(`/${prompt.name}`));

    if (prompt.description) {
      lines.push(`    ${theme.fg("dim", prompt.description)}`);
    }

    lines.push(`    ${theme.fg("dim", prompt.sourceInfo.path)}`);
  }

  return lines;
}
