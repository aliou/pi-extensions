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
import type { Params, Question } from "./types";

export async function runAskUserUI(
  ctx: ExtensionContext,
  params: Params,
): Promise<ExecuteResult | null> {
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

  return ctx.ui.custom<ExecuteResult | null>((tui, theme, _kb, done) => {
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
  });
}
