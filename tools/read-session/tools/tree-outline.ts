import { defineTool, SessionManager } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { compactEntry } from "./entry-utils";
import { getTargetSessionPath } from "./utils";

export const treeOutline = defineTool({
  name: "get_tree_outline",
  label: "Get Tree Outline",
  description:
    "Get a compact outline of the full session tree. Returns previews only.",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) => {
    const targetSessionPath = await getTargetSessionPath(ctx);
    const sm = SessionManager.open(targetSessionPath);
    const currentBranchIds = new Set(sm.getBranch().map((e) => e.id));

    const visit = (node: ReturnType<typeof sm.getTree>[number]): unknown => ({
      ...compactEntry(
        node.entry,
        node.label ?? sm.getLabel(node.entry.id),
        node.children.length,
        currentBranchIds.has(node.entry.id),
      ),
      children: node.children.map(visit),
    });

    const outline = sm.getTree().map(visit);

    return {
      content: [{ type: "text", text: JSON.stringify(outline) }],
      details: { outline },
    };
  },
});
