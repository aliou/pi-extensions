import { defineTool, SessionManager } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { compactEntry, entryRole } from "./entry-utils";
import { getTargetSessionPath } from "./utils";

export const branchEntries = defineTool({
  name: "get_branch_entries",
  label: "Get Branch Entries",
  description:
    "Get compact entries from the current branch, or from a branch ending at a specific leaf id. Returns previews only.",
  parameters: Type.Object({
    leafId: Type.Optional(Type.String({ description: "Branch leaf entry id" })),
    fromEnd: Type.Optional(
      Type.Boolean({
        description: "Return entries leaf-to-root instead of root-to-leaf",
      }),
    ),
    limit: Type.Optional(
      Type.Number({ description: "Maximum entries to return" }),
    ),
    types: Type.Optional(Type.Array(Type.String())),
    roles: Type.Optional(Type.Array(Type.String())),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
    const sm = SessionManager.open(await getTargetSessionPath(ctx));
    let entries = sm.getBranch(params.leafId);
    if (!params.fromEnd) entries = [...entries].reverse();

    if (params.types?.length) {
      entries = entries.filter((e) => params.types?.includes(e.type));
    }
    if (params.roles?.length) {
      entries = entries.filter((e) => {
        const role = entryRole(e);
        return role ? params.roles?.includes(role) : false;
      });
    }
    if (params.limit && params.limit > 0)
      entries = entries.slice(0, params.limit);

    const branchIds = new Set(sm.getBranch().map((e) => e.id));
    const result = entries.map((e) =>
      compactEntry(
        e,
        sm.getLabel(e.id),
        sm.getChildren(e.id).length,
        branchIds.has(e.id),
      ),
    );

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      details: { entries: result },
    };
  },
});
