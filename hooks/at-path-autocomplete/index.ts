/**
 * `@`-path autocomplete hook.
 *
 * Wraps the default autocomplete provider to rewrite `@`-prefixed file
 * completions on the way out:
 *
 * - The leading `@` is dropped from the inserted value.
 * - Relative paths (not starting with `/`, `~`, `./`, or `../`) are
 *   prepended with `./`.
 * - Quoted paths (e.g. `@"foo bar.ts"`) keep their quotes and still get
 *   the `./` prepend inside them.
 *
 * `applyCompletion` is delegated to the inner provider unchanged, because
 * the inner `@` branch is selected by the typed `prefix` (still `@...`)
 * and simply inserts `item.value` -- which we have already rewritten in
 * `getSuggestions`. The single `item.value` flows from the dropdown into
 * the line on accept, so rewriting it there fixes insertion too.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui";

/**
 * Rewrite a single `@`-prefixed completion value.
 *
 * - `@src/foo.ts`        -> `./src/foo.ts`
 * - `@"foo bar.ts"`      -> `"./foo bar.ts"`
 * - `@/abs/x`            -> `/abs/x`
 * - `@~/x`               -> `~/x`
 * - `@./already/x`       -> `./already/x`
 * - `@../parent/x`       -> `../parent/x`
 */
function rewriteAtValue(value: string): string {
  if (!value.startsWith("@")) return value;

  const quoted = value.startsWith('@"');
  const inner = quoted ? value.slice(2, -1) : value.slice(1);

  const isAbsolute = inner.startsWith("/");
  const isHome = inner.startsWith("~/");
  const isDotted = inner.startsWith("./") || inner.startsWith("../");
  const finalInner = isAbsolute || isHome || isDotted ? inner : `./${inner}`;

  return quoted ? `"${finalInner}"` : finalInner;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.addAutocompleteProvider((current: AutocompleteProvider) => ({
      triggerCharacters: current.triggerCharacters,
      async getSuggestions(
        lines: string[],
        cursorLine: number,
        cursorCol: number,
        options: { signal: AbortSignal; force?: boolean },
      ): Promise<AutocompleteSuggestions | null> {
        const result = await current.getSuggestions(
          lines,
          cursorLine,
          cursorCol,
          options,
        );
        if (!result) return null;
        if (!result.prefix.startsWith("@")) return result;

        let changed = false;
        const items: AutocompleteItem[] = result.items.map((item) => {
          if (!item.value.startsWith("@")) return item;
          changed = true;
          return { ...item, value: rewriteAtValue(item.value) };
        });

        return changed ? { ...result, items } : result;
      },
      applyCompletion(
        lines: string[],
        cursorLine: number,
        cursorCol: number,
        item: AutocompleteItem,
        prefix: string,
      ) {
        return current.applyCompletion(
          lines,
          cursorLine,
          cursorCol,
          item,
          prefix,
        );
      },
      shouldTriggerFileCompletion(
        lines: string[],
        cursorLine: number,
        cursorCol: number,
      ) {
        return (
          current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
          true
        );
      },
    }));
  });
}
