import type {
  CustomEntry,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import {
  SUBAGENT_SESSION_CUSTOM_TYPE,
  type SubagentSessionRecord,
} from "./types";

function isSubagentSessionRecordData(
  data: unknown,
): data is SubagentSessionRecord {
  if (
    typeof data !== "object" ||
    data === null ||
    !("type" in data) ||
    !("name" in data) ||
    !("sessionId" in data) ||
    !("sessionFile" in data) ||
    !("parentSessionId" in data)
  ) {
    return false;
  }

  return (
    data.type === SUBAGENT_SESSION_CUSTOM_TYPE &&
    typeof data.name === "string" &&
    typeof data.sessionId === "string" &&
    typeof data.sessionFile === "string" &&
    typeof data.parentSessionId === "string" &&
    (!("model" in data) || isModelPreferenceRecord(data.model)) &&
    (!("skills" in data) ||
      (Array.isArray(data.skills) &&
        data.skills.every(
          (s: unknown) =>
            typeof s === "object" && s !== null && "name" in s && "path" in s,
        )))
  );
}

function isModelPreferenceRecord(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "provider" in data &&
    "model" in data &&
    "thinking" in data &&
    typeof data.provider === "string" &&
    typeof data.model === "string" &&
    typeof data.thinking === "string"
  );
}

function isSubagentSessionRecordEntry(
  entry: SessionEntry,
): entry is CustomEntry<SubagentSessionRecord> {
  return (
    entry.type === "custom" &&
    entry.customType === SUBAGENT_SESSION_CUSTOM_TYPE &&
    isSubagentSessionRecordData(entry.data)
  );
}

export class SubagentSessionRecordStore {
  constructor(private pi: ExtensionAPI) {}

  append(record: SubagentSessionRecord) {
    this.pi.appendEntry<SubagentSessionRecord>(
      SUBAGENT_SESSION_CUSTOM_TYPE,
      record,
    );
  }

  findBySubagent(ctx: ExtensionContext, subagentName: string) {
    return ctx.sessionManager
      .getEntries()
      .filter(isSubagentSessionRecordEntry)
      .filter((entry) => entry.data?.name === subagentName);
  }

  findBySessionId(
    ctx: ExtensionContext,
    subagentName: string,
    sessionId: string,
  ) {
    return this.findBySubagent(ctx, subagentName).find(
      (entry) => entry.data?.sessionId === sessionId,
    )?.data;
  }
}
