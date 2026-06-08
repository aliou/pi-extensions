import type {
  CustomEntry,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";

export type StashAction = "stash" | "pop" | "insert" | "empty-warn";

const STASH_CUSTOM_TYPE = "editor-stash";

export type StashData = { content: string | null };

export function determineAction(
  editorHasContent: boolean,
  stashHasContent: boolean,
): StashAction {
  if (!editorHasContent && !stashHasContent) return "empty-warn";
  if (editorHasContent && !stashHasContent) return "stash";
  if (!editorHasContent && stashHasContent) return "pop";
  return "insert";
}

function isStashEntry(entry: SessionEntry): entry is CustomEntry<StashData> {
  return (
    entry.type === "custom" &&
    (entry as CustomEntry<StashData>).customType === STASH_CUSTOM_TYPE
  );
}

export function findLatestStashEntry(
  entries: SessionEntry[],
): StashData | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && isStashEntry(entry)) {
      return entry.data ?? null;
    }
  }
  return null;
}

export function isLastEntryStashWithContent(entries: SessionEntry[]): boolean {
  if (entries.length === 0) return false;
  const last = entries[entries.length - 1];
  if (!last || !isStashEntry(last)) return false;
  return last.data?.content != null;
}

export function getStashContent(entries: SessionEntry[]): string | null {
  const entry = findLatestStashEntry(entries);
  return entry?.content ?? null;
}
