import { defineTool, SessionManager } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { compactEntry, fullEntryContent } from "./entry-utils";
import { getTargetSessionPath } from "./utils";

export const readEntry = defineTool({
  name: "read_entry",
  label: "Read Entry",
  description: "Read full content for exactly one session entry by id.",
  parameters: Type.Object({
    id: Type.String({ description: "Entry id" }),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
    const targetSessionPath = await getTargetSessionPath(ctx);
    const sm = SessionManager.open(targetSessionPath);
    const entry = sm.getEntry(params.id);
    if (!entry) throw new Error(`No entry found with id '${params.id}'`);

    const currentBranchIds = new Set(sm.getBranch().map((e) => e.id));
    const result = {
      ...compactEntry(
        entry,
        sm.getLabel(entry.id),
        sm.getChildren(entry.id).length,
        currentBranchIds.has(entry.id),
      ),
      childrenIds: sm.getChildren(entry.id).map((e) => e.id),
      content: fullEntryContent(entry),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      details: { entry: result },
    };
  },
});
