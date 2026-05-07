import type { AutocompleteItem } from "@earendil-works/pi-tui";

export interface CompletionEditResult {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
}

export interface PrefixCompletionItemOptions {
  value: string;
  label?: string;
  description?: string;
}

export function replaceAutocompletePrefix(
  lines: string[],
  cursorLine: number,
  cursorCol: number,
  prefix: string,
  value: string,
): CompletionEditResult {
  const currentLine = lines[cursorLine] ?? "";
  const beforePrefix = currentLine.slice(0, cursorCol - prefix.length);
  const afterCursor = currentLine.slice(cursorCol);
  const newLines = [...lines];
  newLines[cursorLine] = `${beforePrefix}${value}${afterCursor}`;

  return {
    lines: newLines,
    cursorLine,
    cursorCol: beforePrefix.length + value.length,
  };
}

export function createPrefixCompletionItem({
  value,
  label = value,
  description,
}: PrefixCompletionItemOptions): AutocompleteItem {
  return {
    value,
    label,
    ...(description !== undefined ? { description } : {}),
  };
}

export function extractPrefixCandidate(
  textBeforeCursor: string,
  targetPrefix: string,
): string | undefined {
  const match = textBeforeCursor.match(/(^|\s)(@\S*)$/);
  const candidate = match?.[2];

  if (!candidate || !targetPrefix.startsWith(candidate)) {
    return undefined;
  }

  return candidate;
}

export function prependCompletionItem(
  items: AutocompleteItem[] | undefined,
  item: AutocompleteItem,
): AutocompleteItem[] {
  return [
    item,
    ...(items?.filter((other) => other.value !== item.value) ?? []),
  ];
}
