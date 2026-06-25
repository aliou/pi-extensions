// biome-ignore lint/plugin: direct child_process usage is required in this helper where ExtensionAPI is unavailable.
import { spawnSync } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  CombinedAutocompleteProvider,
  type SelectListTheme,
} from "@earendil-works/pi-tui";
import {
  AskUserComponent,
  type ComponentState,
  type ExecuteResult,
} from "./component";
import type { Answer, Params, Question } from "./types";

export async function runAskUserUI(
  ctx: ExtensionContext,
  params: Params,
): Promise<ExecuteResult | null | undefined> {
  if (ctx.mode !== "tui") {
    return runSelectFallback(ctx, params);
  }

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

  return ctx.ui.custom<ExecuteResult | null | undefined>(
    (tui, theme, _kb, done) => {
      const selectListTheme: SelectListTheme = {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("muted", t),
        noMatch: (t) => theme.fg("muted", t),
      };

      return new AskUserComponent(
        state,
        params,
        params.questions as Question[],
        autocompleteProvider,
        theme,
        selectListTheme,
        tui,
        done,
      );
    },
  );
}

async function runSelectFallback(
  ctx: ExtensionContext,
  params: Params,
): Promise<ExecuteResult | null | undefined> {
  const answers: Answer[] = [];

  for (const question of params.questions as Question[]) {
    const options = question.options.map((option) =>
      option.description
        ? `${option.label} — ${option.description}`
        : option.label,
    );
    const selected = await ctx.ui.select(question.question, options, {
      signal: ctx.signal,
    });

    if (selected === undefined) {
      return null;
    }

    const selectedIndex = options.indexOf(selected);
    const selectedOption = question.options[selectedIndex];
    answers.push({
      question: question.question,
      header: question.header,
      selections: [selectedOption?.label ?? selected],
    });
  }

  const responseText = answers
    .map((answer) => `${answer.header}: ${answer.selections.join(", ")}`)
    .join("\n");

  return {
    content: [{ type: "text", text: responseText }],
    details: { questions: params.questions, answers },
  };
}
