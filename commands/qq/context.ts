import type {
  CustomEntry,
  CustomMessageEntry,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type { QqAnswerDetails, QqContextDetails } from "./types";
import { QQ_ANSWER_TYPE, QQ_CONTEXT_TYPE } from "./types";

export interface QqListItem {
  entry: CustomEntry<QqAnswerDetails>;
  details: QqAnswerDetails;
  status: "available" | "in_context" | "available_after_compaction";
}

export function isQqAnswerEntry(
  entry: SessionEntry,
): entry is CustomEntry<QqAnswerDetails> {
  return entry.type === "custom" && entry.customType === QQ_ANSWER_TYPE;
}

export function isQqContextEntry(
  entry: SessionEntry,
): entry is CustomMessageEntry<QqContextDetails> {
  return (
    entry.type === "custom_message" && entry.customType === QQ_CONTEXT_TYPE
  );
}

export function buildQqList(entries: SessionEntry[]): QqListItem[] {
  const indexByEntryId = new Map(
    entries.map((entry, index) => [entry.id, index]),
  );
  const compactionIndexes = entries
    .map((entry, index) => (entry.type === "compaction" ? index : -1))
    .filter((index) => index >= 0);

  return entries.filter(isQqAnswerEntry).flatMap<QqListItem>((entry) => {
    if (!entry.data) return [];

    const answerIndex = indexByEntryId.get(entry.id) ?? -1;
    const insertions = entries
      .filter(isQqContextEntry)
      .filter((candidate) => candidate.details?.qqId === entry.data?.id)
      .filter(
        (candidate) => (indexByEntryId.get(candidate.id) ?? -1) > answerIndex,
      );

    const latestInsertion = insertions.at(-1);
    if (!latestInsertion) {
      return [{ entry, details: entry.data, status: "available" as const }];
    }

    const insertionIndex = indexByEntryId.get(latestInsertion.id) ?? -1;
    const hasCompactionAfterInsertion = compactionIndexes.some(
      (index) => index > insertionIndex,
    );

    return [
      {
        entry,
        details: entry.data,
        status: hasCompactionAfterInsertion
          ? "available_after_compaction"
          : "in_context",
      },
    ];
  });
}
