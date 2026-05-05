import { defineTool, SessionManager } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { compactEntry, flattenTree } from "./entry-utils";
import { getTargetSessionPath } from "./utils";

export const sessionOverview = defineTool({
  name: "get_session_overview",
  label: "Get Session Overview",
  description:
    "Get compact metadata for a session. Does not return full message content.",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) => {
    const sm = SessionManager.open(await getTargetSessionPath(ctx));
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
      parentSessionPath: sm.getHeader()?.parentSession,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(overview) }],
      details: { overview },
    };
  },
});
