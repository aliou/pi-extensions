import { spawnSync } from "node:child_process";
import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import {
  CombinedAutocompleteProvider,
  Key,
  matchesKey,
  SelectList,
  type SelectListTheme,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";
import type { Static } from "@sinclair/typebox";
import type { AskUserQuestionParams } from "./schema";
import type { Answer, AskUserQuestionDetails, Question } from "./types";

type Params = Static<typeof AskUserQuestionParams>;

interface ExecuteResult {
  content: Array<{ type: "text"; text: string }>;
  details: AskUserQuestionDetails;
}

interface ComponentState {
  mode: "question" | "other-input" | "confirm";
  currentIndex: number;
  highlightIndex: number;
  answers: string[][];
  otherLines: string[];
  otherCursorLine: number;
  otherCursorCol: number;
}

export async function executeAskUserQuestion(
  ctx: ExtensionContext,
  params: Params,
): Promise<ExecuteResult> {
  if (!ctx.hasUI) {
    return {
      content: [
        {
          type: "text",
          text: "Error: UI not available (running in non-interactive mode)",
        },
      ],
      details: {
        questions: params.questions,
        answers: [],
        error: "UI not available",
      },
    };
  }

  // Find fd binary for autocomplete
  const fdResult = spawnSync("which", ["fd"], { encoding: "utf-8" });
  const fdPath = fdResult.status === 0 ? fdResult.stdout.trim() : null;
  const autocompleteProvider = new CombinedAutocompleteProvider(
    [],
    process.cwd(),
    fdPath ?? null,
  );

  const initialAnswers: string[][] = params.questions.map(() => []);
  const state: ComponentState = {
    mode: "question",
    currentIndex: 0,
    highlightIndex: 0,
    answers: initialAnswers,
    otherLines: [""],
    otherCursorLine: 0,
    otherCursorCol: 0,
  };

  const result = await ctx.ui.custom<ExecuteResult | null>(
    (tui, theme, _kb, done) => {
      const selectListTheme: SelectListTheme = {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("muted", t),
        noMatch: (t) => theme.fg("muted", t),
      };
      let autocompleteList: SelectList | null = null;
      let autocompletePrefix = "";

      const getAutocompleteList = () => autocompleteList;
      const setAutocompleteList = (list: SelectList | null) => {
        autocompleteList = list;
      };
      const getAutocompletePrefix = () => autocompletePrefix;
      const setAutocompletePrefix = (prefix: string) => {
        autocompletePrefix = prefix;
      };

      return {
        render(width: number): string[] {
          if (state.mode === "confirm") {
            return renderConfirmScreen(
              width,
              params.questions,
              state.answers,
              theme,
            );
          }

          if (state.mode === "other-input") {
            return renderOtherInput(
              width,
              params.questions,
              state,
              theme,
              getAutocompleteList(),
            );
          }

          // mode === "question"
          return renderQuestionScreen(width, params.questions, state, theme);
        },

        invalidate(): void {
          // No-op, we call tui.requestRender() in handleInput
        },

        handleInput(data: string): void {
          if (state.mode === "question") {
            handleQuestionInput(data, state, params.questions, tui, done);
          } else if (state.mode === "other-input") {
            handleOtherInput(
              data,
              state,
              params.questions,
              tui,
              autocompleteProvider,
              selectListTheme,
              getAutocompleteList,
              setAutocompleteList,
              getAutocompletePrefix,
              setAutocompletePrefix,
            );
          } else if (state.mode === "confirm") {
            handleConfirmInput(data, state, params, tui, done);
          }
        },
      };
    },
  );

  if (!result) {
    return {
      content: [{ type: "text", text: "User cancelled" }],
      details: { questions: params.questions, answers: [], error: "cancelled" },
    };
  }

  return result;
}

function renderProgressDots(
  theme: Theme,
  currentIndex: number,
  totalQuestions: number,
): string {
  const dots: string[] = [];
  for (let i = 0; i < totalQuestions; i++) {
    if (i < currentIndex) {
      dots.push(theme.fg("success", "●")); // answered
    } else if (i === currentIndex) {
      dots.push(theme.fg("accent", "●")); // current
    } else {
      dots.push(theme.fg("dim", "○")); // unanswered
    }
  }
  return dots.join(" ");
}

function renderQuestionScreen(
  width: number,
  questions: Question[],
  state: ComponentState,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  const question = questions[state.currentIndex];
  if (!question) {
    throw new Error(`Invalid current index: ${state.currentIndex}`);
  }

  // Top border with progress
  const progressDots = renderProgressDots(
    theme,
    state.currentIndex,
    questions.length,
  );
  const progressLine = `${theme.fg("border", "╭")}${theme.fg("border", "─")} ${progressDots} ${theme.fg("border", "─".repeat(Math.max(1, width - visibleWidth(progressDots) - 5)))}${theme.fg("border", "╮")}`;
  lines.push(truncateToWidth(progressLine, width));

  // Empty line
  lines.push(
    theme.fg("border", "│") +
      " ".repeat(Math.max(0, width - 2)) +
      theme.fg("border", "│"),
  );

  // Question with header
  const headerStr = theme.fg("accent", `[${question.header}]`);
  const questionStr = theme.fg("text", question.question);
  const headerAndQuestion = `${headerStr} ${questionStr}`;
  const wrappedQuestion = wrapTextWithAnsi(headerAndQuestion, width - 4);

  for (const line of wrappedQuestion) {
    const paddedLine =
      theme.fg("border", "│") +
      " " +
      truncateToWidth(line, width - 4) +
      " ".repeat(Math.max(0, width - 4 - visibleWidth(line))) +
      " " +
      theme.fg("border", "│");
    lines.push(truncateToWidth(paddedLine, width));
  }

  lines.push(
    theme.fg("border", "│") +
      " ".repeat(Math.max(0, width - 2)) +
      theme.fg("border", "│"),
  );

  // Options
  const agentOther = question.options.find(
    (opt) => opt.label.toLowerCase() === "other",
  );
  const regularOptions = question.options
    .filter((opt) => opt.label.toLowerCase() !== "other")
    .map((opt) => ({
      label: opt.label,
      description: opt.description,
      isOther: false,
    }));
  const allOptions = [
    ...regularOptions,
    {
      label: agentOther?.label ?? "Other",
      description: agentOther?.description ?? "Provide custom text",
      isOther: true,
    },
  ];

  for (let i = 0; i < allOptions.length; i++) {
    const opt = allOptions[i];
    if (!opt) {
      throw new Error(`Invalid option index: ${i}`);
    }
    const isHighlighted = i === state.highlightIndex;
    const currentAnswers = state.answers[state.currentIndex];
    if (!currentAnswers) {
      throw new Error(
        `Invalid current index for answers: ${state.currentIndex}`,
      );
    }
    const isSelected = opt.isOther
      ? currentAnswers.some((s) => s.startsWith("Other:"))
      : currentAnswers.includes(opt.label);

    // biome-ignore lint/plugin: UI arrow indicator
    const prefix = isHighlighted ? theme.fg("accent", "▶ ") : "  ";
    const checkbox = question.multiSelect
      ? isSelected
        ? theme.fg("success", "[✓]")
        : "[ ]"
      : "";
    const label = isHighlighted
      ? theme.fg("accent", opt.label)
      : isSelected
        ? theme.fg("success", opt.label)
        : theme.fg("text", opt.label);
    const desc = theme.fg("muted", `— ${opt.description}`);

    const checkboxPart = question.multiSelect ? `${checkbox} ` : "";
    const optionLine = `${prefix}${checkboxPart}${label} ${desc}`;
    const wrappedOption = wrapTextWithAnsi(optionLine, width - 4);

    for (let j = 0; j < wrappedOption.length; j++) {
      const wrappedLine = wrappedOption[j];
      if (!wrappedLine) {
        throw new Error(`Invalid wrapped line index: ${j}`);
      }
      const paddedLine =
        theme.fg("border", "│") +
        " " +
        truncateToWidth(wrappedLine, width - 4) +
        " ".repeat(Math.max(0, width - 4 - visibleWidth(wrappedLine))) +
        " " +
        theme.fg("border", "│");
      lines.push(truncateToWidth(paddedLine, width));
    }
  }

  // Bottom border with controls
  lines.push(
    theme.fg("border", "│") +
      " ".repeat(Math.max(0, width - 2)) +
      theme.fg("border", "│"),
  );

  const controlsText = question.multiSelect
    ? "Space select · Enter next · Tab navigate · Esc cancel"
    : "Enter select · Tab navigate · Esc cancel";
  const controlsLine =
    theme.fg("border", "├") +
    theme.fg("border", "─".repeat(Math.max(1, width - 2))) +
    theme.fg("border", "┤");
  lines.push(truncateToWidth(controlsLine, width));

  const controlsPadded =
    theme.fg("border", "│") +
    " " +
    truncateToWidth(theme.fg("dim", controlsText), width - 4) +
    " ".repeat(Math.max(0, width - 4 - visibleWidth(controlsText))) +
    " " +
    theme.fg("border", "│");
  lines.push(truncateToWidth(controlsPadded, width));

  lines.push(
    theme.fg("border", "╰") +
      theme.fg("border", "─".repeat(Math.max(1, width - 2))) +
      theme.fg("border", "╯"),
  );

  return lines;
}

function renderOtherInput(
  width: number,
  questions: Question[],
  state: ComponentState,
  theme: Theme,
  autocompleteList: SelectList | null,
): string[] {
  const lines: string[] = [];
  const question = questions[state.currentIndex];
  if (!question) {
    throw new Error(`Invalid current index: ${state.currentIndex}`);
  }

  const contentWidth = width - 4; // │ + space + ... + space + │

  // Top border with progress
  const progressDots = renderProgressDots(
    theme,
    state.currentIndex,
    questions.length,
  );
  const progressLine = `${theme.fg("border", "╭")}${theme.fg("border", "─")} ${progressDots} ${theme.fg("border", "─".repeat(Math.max(1, width - visibleWidth(progressDots) - 5)))}${theme.fg("border", "╮")}`;
  lines.push(truncateToWidth(progressLine, width));

  lines.push(
    theme.fg("border", "│") +
      " ".repeat(Math.max(0, width - 2)) +
      theme.fg("border", "│"),
  );

  // Question header
  const headerStr = theme.fg("accent", `[${question.header}]`);
  const questionStr = theme.fg("text", question.question);
  const headerAndQuestion = `${headerStr} ${questionStr}`;
  const wrappedQuestion = wrapTextWithAnsi(headerAndQuestion, width - 4);

  for (const line of wrappedQuestion) {
    const paddedLine =
      theme.fg("border", "│") +
      " " +
      truncateToWidth(line, width - 4) +
      " ".repeat(Math.max(0, width - 4 - visibleWidth(line))) +
      " " +
      theme.fg("border", "│");
    lines.push(truncateToWidth(paddedLine, width));
  }

  lines.push(
    theme.fg("border", "│") +
      " ".repeat(Math.max(0, width - 2)) +
      theme.fg("border", "│"),
  );

  // "Other" input prompt with multi-line support
  const prefix = theme.fg("warning", "Other: ");
  const prefixWidth = visibleWidth(prefix);
  const indentSpaces = " ".repeat(prefixWidth);

  for (let lineIdx = 0; lineIdx < state.otherLines.length; lineIdx++) {
    const lineText = state.otherLines[lineIdx];
    if (lineText === undefined) {
      throw new Error(`Invalid line index: ${lineIdx}`);
    }
    const isCurrentLine = lineIdx === state.otherCursorLine;

    const linePrefix = lineIdx === 0 ? prefix : indentSpaces;

    let inputDisplay: string;
    if (isCurrentLine) {
      const beforeCursor = lineText.slice(0, state.otherCursorCol);
      const afterCursor = lineText.slice(state.otherCursorCol);
      const cursorCharRaw = afterCursor[0];
      const cursorChar = cursorCharRaw !== undefined ? cursorCharRaw : " ";
      const afterCursorRest =
        afterCursor.length > 0 ? afterCursor.slice(1) : "";
      inputDisplay = `${beforeCursor}\x1b[7m${cursorChar}\x1b[27m${afterCursorRest}`;
    } else {
      inputDisplay = lineText;
    }

    const fullLine = linePrefix + inputDisplay;
    const wrappedInput = wrapTextWithAnsi(fullLine, contentWidth);

    for (const wrappedLine of wrappedInput) {
      const padNeeded = Math.max(0, contentWidth - visibleWidth(wrappedLine));
      const paddedLine =
        theme.fg("border", "│") +
        " " +
        wrappedLine +
        " ".repeat(padNeeded) +
        " " +
        theme.fg("border", "│");
      lines.push(truncateToWidth(paddedLine, width));
    }
  }

  // Render autocomplete list if active
  if (autocompleteList !== null) {
    const autocompleteLines = autocompleteList.render(contentWidth);
    for (const acLine of autocompleteLines) {
      const padNeeded = Math.max(0, contentWidth - visibleWidth(acLine));
      const paddedLine =
        theme.fg("border", "│") +
        " " +
        acLine +
        " ".repeat(padNeeded) +
        " " +
        theme.fg("border", "│");
      lines.push(truncateToWidth(paddedLine, width));
    }
  }

  lines.push(
    theme.fg("border", "│") +
      " ".repeat(Math.max(0, width - 2)) +
      theme.fg("border", "│"),
  );

  // Bottom border
  lines.push(
    theme.fg("border", "├") +
      theme.fg("border", "─".repeat(Math.max(1, width - 2))) +
      theme.fg("border", "┤"),
  );

  const controlsText = "Enter confirm · Shift+Enter newline · Esc cancel";
  const controlsPadded =
    theme.fg("border", "│") +
    " " +
    truncateToWidth(theme.fg("dim", controlsText), width - 4) +
    " ".repeat(Math.max(0, width - 4 - visibleWidth(controlsText))) +
    " " +
    theme.fg("border", "│");
  lines.push(truncateToWidth(controlsPadded, width));

  lines.push(
    theme.fg("border", "╰") +
      theme.fg("border", "─".repeat(Math.max(1, width - 2))) +
      theme.fg("border", "╯"),
  );

  return lines;
}

function renderConfirmScreen(
  width: number,
  questions: Question[],
  answers: string[][],
  theme: Theme,
): string[] {
  const lines: string[] = [];

  // Top border
  lines.push(
    theme.fg("border", "╭") +
      theme.fg("border", "─ Review ") +
      theme.fg("border", "─".repeat(Math.max(1, width - 11))) +
      theme.fg("border", "╮"),
  );

  lines.push(
    theme.fg("border", "│") +
      " ".repeat(Math.max(0, width - 2)) +
      theme.fg("border", "│"),
  );

  // Show all answers
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q) {
      throw new Error(`Invalid question index: ${i}`);
    }
    const ans = answers[i] ?? [];

    // Question line
    const headerStr = theme.fg("accent", `[${q.header}]`);
    const questionStr = theme.fg("text", q.question);
    const headerAndQuestion = `${headerStr} ${questionStr}`;
    const wrappedQuestion = wrapTextWithAnsi(headerAndQuestion, width - 4);

    for (const line of wrappedQuestion) {
      const paddedLine =
        theme.fg("border", "│") +
        " " +
        truncateToWidth(line, width - 4) +
        " ".repeat(Math.max(0, width - 4 - visibleWidth(line))) +
        " " +
        theme.fg("border", "│");
      lines.push(truncateToWidth(paddedLine, width));
    }

    // Answer line
    const answerStr = ans.length > 0 ? ans.join(", ") : "(none)";
    const answerLine =
      theme.fg("success", "→ ") + theme.fg("accent", answerStr);
    const wrappedAnswer = wrapTextWithAnsi(answerLine, width - 4);

    for (const line of wrappedAnswer) {
      const paddedLine =
        theme.fg("border", "│") +
        " " +
        truncateToWidth(line, width - 4) +
        " ".repeat(Math.max(0, width - 4 - visibleWidth(line))) +
        " " +
        theme.fg("border", "│");
      lines.push(truncateToWidth(paddedLine, width));
    }

    if (i < questions.length - 1) {
      lines.push(
        theme.fg("border", "│") +
          " ".repeat(Math.max(0, width - 2)) +
          theme.fg("border", "│"),
      );
    }
  }

  lines.push(
    theme.fg("border", "│") +
      " ".repeat(Math.max(0, width - 2)) +
      theme.fg("border", "│"),
  );

  // Bottom border
  lines.push(
    theme.fg("border", "├") +
      theme.fg("border", "─".repeat(Math.max(1, width - 2))) +
      theme.fg("border", "┤"),
  );

  const controlsText = "Enter submit · Esc go back";
  const controlsPadded =
    theme.fg("border", "│") +
    " " +
    truncateToWidth(theme.fg("dim", controlsText), width - 4) +
    " ".repeat(Math.max(0, width - 4 - visibleWidth(controlsText))) +
    " " +
    theme.fg("border", "│");
  lines.push(truncateToWidth(controlsPadded, width));

  lines.push(
    theme.fg("border", "╰") +
      theme.fg("border", "─".repeat(Math.max(1, width - 2))) +
      theme.fg("border", "╯"),
  );

  return lines;
}

function resetOtherState(state: ComponentState): void {
  state.otherLines = [""];
  state.otherCursorLine = 0;
  state.otherCursorCol = 0;
}

function updateAutocomplete(
  state: ComponentState,
  autocompleteProvider: CombinedAutocompleteProvider,
  selectListTheme: SelectListTheme,
  setAutocompleteList: (list: SelectList | null) => void,
  setAutocompletePrefix: (prefix: string) => void,
  tui: { requestRender: () => void },
): void {
  const controller = new AbortController();
  void autocompleteProvider
    .getSuggestions(
      state.otherLines,
      state.otherCursorLine,
      state.otherCursorCol,
      {
        signal: controller.signal,
      },
    )
    .then((suggestions) => {
      if (suggestions !== null && suggestions.items.length > 0) {
        setAutocompleteList(
          new SelectList(suggestions.items, 6, selectListTheme),
        );
        setAutocompletePrefix(suggestions.prefix);
      } else {
        setAutocompleteList(null);
        setAutocompletePrefix("");
      }
      tui.requestRender();
    })
    .catch(() => {
      setAutocompleteList(null);
      setAutocompletePrefix("");
      tui.requestRender();
    });
}

function handleQuestionInput(
  data: string,
  state: ComponentState,
  questions: Question[],
  tui: { requestRender: () => void },
  done: (result: ExecuteResult | null) => void,
): void {
  const question = questions[state.currentIndex];
  if (!question) {
    throw new Error(`Invalid current index: ${state.currentIndex}`);
  }
  const agentOther = question.options.find(
    (opt) => opt.label.toLowerCase() === "other",
  );
  const regularOptions = question.options.filter(
    (opt) => opt.label.toLowerCase() !== "other",
  );
  const allOptions = [
    ...regularOptions.map((opt) => ({ ...opt, isOther: false })),
    {
      label: agentOther?.label ?? "Other",
      description: agentOther?.description ?? "Provide custom text",
      isOther: true,
    },
  ];

  if (matchesKey(data, Key.escape)) {
    done(null);
    return;
  }

  if (matchesKey(data, Key.tab)) {
    state.currentIndex = (state.currentIndex + 1) % questions.length;
    state.highlightIndex = 0;
    tui.requestRender();
    return;
  }

  if (matchesKey(data, Key.shift("tab"))) {
    state.currentIndex =
      (state.currentIndex - 1 + questions.length) % questions.length;
    state.highlightIndex = 0;
    tui.requestRender();
    return;
  }

  if (matchesKey(data, Key.up)) {
    state.highlightIndex =
      (state.highlightIndex - 1 + allOptions.length) % allOptions.length;
    tui.requestRender();
    return;
  }

  if (matchesKey(data, Key.down)) {
    state.highlightIndex = (state.highlightIndex + 1) % allOptions.length;
    tui.requestRender();
    return;
  }

  if (question.multiSelect && matchesKey(data, Key.space)) {
    const highlighted = allOptions[state.highlightIndex];
    if (!highlighted) {
      throw new Error(`Invalid highlight index: ${state.highlightIndex}`);
    }

    const currentAnswers = state.answers[state.currentIndex];
    if (!currentAnswers) {
      throw new Error(
        `Invalid current index for answers: ${state.currentIndex}`,
      );
    }

    if (highlighted.isOther) {
      // Check if Other is already selected
      const hasOther = currentAnswers.some((s) => s.startsWith("Other:"));
      if (hasOther) {
        // Deselect Other
        state.answers[state.currentIndex] = currentAnswers.filter(
          (s) => !s.startsWith("Other:"),
        );
      } else {
        // Open input for Other
        state.mode = "other-input";
        resetOtherState(state);
      }
    } else {
      const idx = currentAnswers.indexOf(highlighted.label);
      if (idx >= 0) {
        currentAnswers.splice(idx, 1);
      } else {
        currentAnswers.push(highlighted.label);
      }
    }
    tui.requestRender();
    return;
  }

  if (!question.multiSelect && matchesKey(data, Key.enter)) {
    const highlighted = allOptions[state.highlightIndex];
    if (!highlighted) {
      throw new Error(`Invalid highlight index: ${state.highlightIndex}`);
    }

    if (highlighted.isOther) {
      state.mode = "other-input";
      resetOtherState(state);
    } else {
      state.answers[state.currentIndex] = [highlighted.label];
      moveToNextQuestion(state, questions);
    }
    tui.requestRender();
    return;
  }

  if (question.multiSelect && matchesKey(data, Key.enter)) {
    const currentAnswers = state.answers[state.currentIndex];
    if (!currentAnswers) {
      throw new Error(
        `Invalid current index for answers: ${state.currentIndex}`,
      );
    }
    if (currentAnswers.length === 0) {
      state.answers[state.currentIndex] = ["(none)"];
    }
    moveToNextQuestion(state, questions);
    tui.requestRender();
    return;
  }
}

function handleOtherInput(
  data: string,
  state: ComponentState,
  questions: Question[],
  tui: { requestRender: () => void },
  autocompleteProvider: CombinedAutocompleteProvider,
  selectListTheme: SelectListTheme,
  getAutocompleteList: () => SelectList | null,
  setAutocompleteList: (list: SelectList | null) => void,
  getAutocompletePrefix: () => string,
  setAutocompletePrefix: (prefix: string) => void,
): void {
  const autocompleteList = getAutocompleteList();

  // Escape: close autocomplete if active, else switch to question mode
  if (matchesKey(data, Key.escape)) {
    if (autocompleteList !== null) {
      setAutocompleteList(null);
      setAutocompletePrefix("");
    } else {
      state.mode = "question";
      resetOtherState(state);
    }
    tui.requestRender();
    return;
  }

  // When autocomplete is active, delegate up/down to it
  if (autocompleteList !== null && matchesKey(data, Key.up)) {
    autocompleteList.handleInput(data);
    tui.requestRender();
    return;
  }
  if (autocompleteList !== null && matchesKey(data, Key.down)) {
    autocompleteList.handleInput(data);
    tui.requestRender();
    return;
  }

  // Tab or Enter when autocomplete is active: apply completion
  if (
    autocompleteList !== null &&
    (matchesKey(data, Key.tab) || matchesKey(data, Key.enter))
  ) {
    const selectedItem = autocompleteList.getSelectedItem();
    if (selectedItem !== null) {
      const prefix = getAutocompletePrefix();
      const result = autocompleteProvider.applyCompletion(
        state.otherLines,
        state.otherCursorLine,
        state.otherCursorCol,
        selectedItem,
        prefix,
      );
      state.otherLines = result.lines;
      state.otherCursorLine = result.cursorLine;
      state.otherCursorCol = result.cursorCol;
    }
    // Close autocomplete — do not re-trigger (matches editor behaviour).
    setAutocompleteList(null);
    setAutocompletePrefix("");
    tui.requestRender();
    return;
  }

  // Enter (no autocomplete): confirm/submit
  if (matchesKey(data, Key.enter)) {
    const currentAnswers = state.answers[state.currentIndex];
    if (!currentAnswers) {
      throw new Error(
        `Invalid current index for answers: ${state.currentIndex}`,
      );
    }
    const text = state.otherLines.join("\n");
    if (text.trim()) {
      currentAnswers.push(`Other: ${text}`);
    }
    resetOtherState(state);

    const question = questions[state.currentIndex];
    if (!question) {
      throw new Error(`Invalid current index: ${state.currentIndex}`);
    }
    if (!question.multiSelect) {
      // Single-select: advance to next question
      state.mode = "question";
      moveToNextQuestion(state, questions);
    } else {
      state.mode = "question";
    }
    tui.requestRender();
    return;
  }

  // Shift+Enter: insert newline
  if (matchesKey(data, Key.shift("enter"))) {
    const currentLine = state.otherLines[state.otherCursorLine];
    if (currentLine === undefined) {
      throw new Error(`Invalid cursor line: ${state.otherCursorLine}`);
    }
    const beforeCursor = currentLine.slice(0, state.otherCursorCol);
    const afterCursor = currentLine.slice(state.otherCursorCol);
    state.otherLines[state.otherCursorLine] = beforeCursor;
    state.otherLines.splice(state.otherCursorLine + 1, 0, afterCursor);
    state.otherCursorLine++;
    state.otherCursorCol = 0;
    tui.requestRender();
    return;
  }

  // ctrl-d: clear input and exit back to question mode
  if (matchesKey(data, Key.ctrl("d"))) {
    setAutocompleteList(null);
    setAutocompletePrefix("");
    resetOtherState(state);
    state.mode = "question";
    tui.requestRender();
    return;
  }

  // Backspace
  if (matchesKey(data, Key.backspace)) {
    if (state.otherCursorCol > 0) {
      // Delete char before cursor in current line
      const currentLine = state.otherLines[state.otherCursorLine];
      if (currentLine === undefined) {
        throw new Error(`Invalid cursor line: ${state.otherCursorLine}`);
      }
      state.otherLines[state.otherCursorLine] =
        currentLine.slice(0, state.otherCursorCol - 1) +
        currentLine.slice(state.otherCursorCol);
      state.otherCursorCol--;
    } else if (state.otherCursorLine > 0) {
      // At col 0 with previous line: merge with previous
      const prevLine = state.otherLines[state.otherCursorLine - 1];
      const currentLine = state.otherLines[state.otherCursorLine];
      if (prevLine === undefined || currentLine === undefined) {
        throw new Error(`Invalid cursor line: ${state.otherCursorLine}`);
      }
      const newCol = prevLine.length;
      state.otherLines[state.otherCursorLine - 1] = prevLine + currentLine;
      state.otherLines.splice(state.otherCursorLine, 1);
      state.otherCursorLine--;
      state.otherCursorCol = newCol;
    }
    tui.requestRender();
    return;
  }

  // ctrl-a / Home: go to start of current line
  if (matchesKey(data, Key.ctrl("a")) || matchesKey(data, Key.home)) {
    state.otherCursorCol = 0;
    tui.requestRender();
    return;
  }

  // ctrl-e / End: go to end of current line
  if (matchesKey(data, Key.ctrl("e")) || matchesKey(data, Key.end)) {
    const currentLine = state.otherLines[state.otherCursorLine];
    if (currentLine !== undefined) {
      state.otherCursorCol = currentLine.length;
    }
    tui.requestRender();
    return;
  }

  // ctrl-w: delete word backward
  if (matchesKey(data, Key.ctrl("w"))) {
    const currentLine = state.otherLines[state.otherCursorLine];
    if (currentLine === undefined) {
      throw new Error(`Invalid cursor line: ${state.otherCursorLine}`);
    }
    const before = currentLine.slice(0, state.otherCursorCol);
    const trimmed = before.replace(/\s+$/, "");
    const lastSpace = trimmed.lastIndexOf(" ");
    const newPos = lastSpace === -1 ? 0 : lastSpace + 1;
    state.otherLines[state.otherCursorLine] =
      currentLine.slice(0, newPos) + currentLine.slice(state.otherCursorCol);
    state.otherCursorCol = newPos;
    tui.requestRender();
    return;
  }

  // ctrl-u: delete from start of current line to cursor
  if (matchesKey(data, Key.ctrl("u"))) {
    const currentLine = state.otherLines[state.otherCursorLine];
    if (currentLine === undefined) {
      throw new Error(`Invalid cursor line: ${state.otherCursorLine}`);
    }
    state.otherLines[state.otherCursorLine] = currentLine.slice(
      state.otherCursorCol,
    );
    state.otherCursorCol = 0;
    tui.requestRender();
    return;
  }

  // ctrl-k: delete from cursor to end of current line
  if (matchesKey(data, Key.ctrl("k"))) {
    const currentLine = state.otherLines[state.otherCursorLine];
    if (currentLine === undefined) {
      throw new Error(`Invalid cursor line: ${state.otherCursorLine}`);
    }
    state.otherLines[state.otherCursorLine] = currentLine.slice(
      0,
      state.otherCursorCol,
    );
    tui.requestRender();
    return;
  }

  // Up arrow: move to previous line
  if (matchesKey(data, Key.up)) {
    if (state.otherCursorLine > 0) {
      state.otherCursorLine--;
      const prevLine = state.otherLines[state.otherCursorLine];
      if (prevLine !== undefined) {
        state.otherCursorCol = Math.min(state.otherCursorCol, prevLine.length);
      }
    }
    tui.requestRender();
    return;
  }

  // Down arrow: move to next line
  if (matchesKey(data, Key.down)) {
    if (state.otherCursorLine < state.otherLines.length - 1) {
      state.otherCursorLine++;
      const nextLine = state.otherLines[state.otherCursorLine];
      if (nextLine !== undefined) {
        state.otherCursorCol = Math.min(state.otherCursorCol, nextLine.length);
      }
    }
    tui.requestRender();
    return;
  }

  // Left arrow
  if (matchesKey(data, Key.left)) {
    if (state.otherCursorCol > 0) {
      state.otherCursorCol--;
    } else if (state.otherCursorLine > 0) {
      // Wrap to end of previous line
      state.otherCursorLine--;
      const prevLine = state.otherLines[state.otherCursorLine];
      if (prevLine !== undefined) {
        state.otherCursorCol = prevLine.length;
      }
    }
    tui.requestRender();
    return;
  }

  // Right arrow
  if (matchesKey(data, Key.right)) {
    const currentLine = state.otherLines[state.otherCursorLine];
    if (
      currentLine !== undefined &&
      state.otherCursorCol < currentLine.length
    ) {
      state.otherCursorCol++;
    } else if (state.otherCursorLine < state.otherLines.length - 1) {
      // Wrap to start of next line
      state.otherCursorLine++;
      state.otherCursorCol = 0;
    }
    tui.requestRender();
    return;
  }

  // Tab (no autocomplete active): force file completion at cursor.
  // Mirrors the editor's forceFileAutocomplete: if exactly one match, apply immediately.
  if (matchesKey(data, Key.tab)) {
    const controller = new AbortController();
    void autocompleteProvider
      .getSuggestions(
        state.otherLines,
        state.otherCursorLine,
        state.otherCursorCol,
        {
          signal: controller.signal,
          force: true,
        },
      )
      .then((forced) => {
        if (forced !== null && forced.items.length > 0) {
          if (forced.items.length === 1) {
            // Single match: apply immediately and close
            const result = autocompleteProvider.applyCompletion(
              state.otherLines,
              state.otherCursorLine,
              state.otherCursorCol,
              // biome-ignore lint/style/noNonNullAssertion: length checked above
              forced.items[0]!,
              forced.prefix,
            );
            state.otherLines = result.lines;
            state.otherCursorLine = result.cursorLine;
            state.otherCursorCol = result.cursorCol;
            setAutocompleteList(null);
            setAutocompletePrefix("");
          } else {
            // Multiple matches: open list
            setAutocompleteList(
              new SelectList(forced.items, 6, selectListTheme),
            );
            setAutocompletePrefix(forced.prefix);
          }
        }
        tui.requestRender();
      })
      .catch(() => {
        tui.requestRender();
      });
    return;
  }

  // Accept printable input (single chars or pasted text)
  const printable = data
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally filtering control chars
    .replace(/\x1b\[200~/g, "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally filtering control chars
    .replace(/\x1b\[201~/g, "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally filtering control chars
    .replace(/[\x00-\x1f\x7f]/g, "");
  if (printable.length > 0) {
    const currentLine = state.otherLines[state.otherCursorLine];
    if (currentLine === undefined) {
      throw new Error(`Invalid cursor line: ${state.otherCursorLine}`);
    }
    state.otherLines[state.otherCursorLine] =
      currentLine.slice(0, state.otherCursorCol) +
      printable +
      currentLine.slice(state.otherCursorCol);
    state.otherCursorCol += printable.length;
    // Trigger autocomplete when typing `@`, or keep it updated while a list is open
    if (printable.endsWith("@") || getAutocompleteList() !== null) {
      updateAutocomplete(
        state,
        autocompleteProvider,
        selectListTheme,
        setAutocompleteList,
        setAutocompletePrefix,
        tui,
      );
      return;
    }
    tui.requestRender();
    return;
  }
}

function handleConfirmInput(
  data: string,
  state: ComponentState,
  params: Params,
  tui: { requestRender: () => void },
  done: (result: ExecuteResult | null) => void,
): void {
  if (matchesKey(data, Key.escape)) {
    state.mode = "question";
    state.currentIndex = params.questions.length - 1;
    state.highlightIndex = 0;
    tui.requestRender();
    return;
  }

  if (matchesKey(data, Key.enter)) {
    // Format and submit
    const answers: Answer[] = params.questions.map((q, idx) => ({
      question: q.question,
      header: q.header,
      selections: state.answers[idx] ?? [],
    }));

    const responseText = answers
      .map(
        (a) =>
          `${a.header}: ${a.question}\nSelected: ${a.selections.join(", ")}`,
      )
      .join("\n\n");

    done({
      content: [{ type: "text", text: responseText }],
      details: { questions: params.questions, answers },
    });
    return;
  }
}

function moveToNextQuestion(
  state: ComponentState,
  questions: Question[],
): void {
  if (state.currentIndex < questions.length - 1) {
    state.currentIndex++;
    state.highlightIndex = 0;
  } else {
    // Move to confirm screen
    state.mode = "confirm";
  }
}
