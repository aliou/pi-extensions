import { defineTool, SessionManager } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { compactEntry, flattenTree } from "./entry-utils";
import { getTargetSessionPath } from "./utils";

const SESSION_LINK_MARKER_TYPE = "session-link-marker";
const SESSION_LINK_SOURCE_TYPE = "session-link-source";

type SessionLinkDetails = {
  targetSessionFile?: string;
  parentSessionFile?: string;
};

const getSessionLinkDetails = (
  entry: unknown,
  customType: string,
): SessionLinkDetails | undefined => {
  if (!entry || typeof entry !== "object") return undefined;
  const candidate = entry as {
    type?: string;
    customType?: string;
    details?: unknown;
  };

  if (candidate.type !== "custom_message") return undefined;
  if (candidate.customType !== customType) return undefined;
  if (!candidate.details || typeof candidate.details !== "object") {
    return undefined;
  }

  return candidate.details as SessionLinkDetails;
};

const uniqueStrings = (values: Array<string | undefined>): string[] => [
  ...new Set(values.filter((value): value is string => !!value)),
];

export const sessionOverview = defineTool({
  name: "get_session_overview",
  label: "Get Session Overview",
  description:
    "Get compact metadata for a session. Does not return full message content.",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) => {
    const targetSessionPath = await getTargetSessionPath(ctx);
    const sm = SessionManager.open(targetSessionPath);
    const entries = sm.getEntries();
    const tree = sm.getTree();
    const leaf = sm.getLeafEntry();
    const currentBranchIds = new Set(sm.getBranch().map((e) => e.id));
    const labels = entries
      .filter((e) => e.type === "label")
      .map((e) => e.targetId)
      .filter((id, index, ids) => ids.indexOf(id) === index && sm.getLabel(id));
    const leaves = flattenTree(tree).filter(
      (e) => sm.getChildren(e.id).length === 0,
    );
    const parentSessionPath =
      sm.getHeader()?.parentSession ??
      entries
        .map((entry) => getSessionLinkDetails(entry, SESSION_LINK_SOURCE_TYPE))
        .find((details) => details?.parentSessionFile)?.parentSessionFile;
    const childSessionPaths = uniqueStrings(
      entries.map(
        (entry) =>
          getSessionLinkDetails(entry, SESSION_LINK_MARKER_TYPE)
            ?.targetSessionFile,
      ),
    );

    const overview = {
      id: sm.getSessionId(),
      cwd: sm.getCwd(),
      name: sm.getSessionName(),
      created: sm.getHeader()?.timestamp,
      currentLeafId: sm.getLeafId(),
      currentLeafPreview: leaf
        ? compactEntry(
            leaf,
            sm.getLabel(leaf.id),
            sm.getChildren(leaf.id).length,
            currentBranchIds.has(leaf.id),
          )
        : undefined,
      entryCount: entries.length,
      messageCount: entries.filter(
        (e) => e.type === "message" || e.type === "custom_message",
      ).length,
      compactionCount: entries.filter((e) => e.type === "compaction").length,
      branchCount: leaves.length,
      labelCount: labels.length,
      parentSessionPath,
      childSessionPaths,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(overview) }],
      details: { overview },
    };
  },
});
