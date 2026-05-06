import { defineTool, SessionManager } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { compactEntry } from "./entry-utils";
import { getTargetSessionPath } from "./utils";

export const labels = defineTool({
  name: "get_labels",
  label: "Get Labels",
  description:
    "Get active labels as navigation anchors with compact target previews.",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) => {
    const targetSessionPath = await getTargetSessionPath(ctx);
    const sm = SessionManager.open(targetSessionPath);
    const currentBranchIds = new Set(sm.getBranch().map((e) => e.id));
    const seen = new Set<string>();

    const result = sm
      .getEntries()
      .filter((e) => e.type === "label")
      .map((e) => e.targetId)
      .filter((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return Boolean(sm.getLabel(id));
      })
      .map((id) => {
        const entry = sm.getEntry(id);
        return {
          targetId: id,
          label: sm.getLabel(id),
          target: entry
            ? compactEntry(
                entry,
                sm.getLabel(id),
                sm.getChildren(id).length,
                currentBranchIds.has(id),
              )
            : undefined,
        };
      });

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      details: { labels: result },
    };
  },
});
