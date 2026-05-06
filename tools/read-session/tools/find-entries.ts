import { defineTool, SessionManager } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { compactEntry, entrySearchText } from "./entry-utils";
import { getTargetSessionPath } from "./utils";

const snippetFor = (text: string, query: string): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  const idx = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return normalized.slice(0, 180);
  const start = Math.max(0, idx - 60);
  const end = Math.min(normalized.length, idx + query.length + 120);
  return `${start > 0 ? "…" : ""}${normalized.slice(start, end)}${end < normalized.length ? "…" : ""}`;
};

export const findEntries = defineTool({
  name: "find_entries",
  label: "Find Entries",
  description:
    "Search entries by text. Defaults to current branch. Returns matching ids and snippets only.",
  parameters: Type.Object({
    query: Type.String(),
    scope: Type.Optional(
      Type.Union([Type.Literal("current_branch"), Type.Literal("full_tree")]),
    ),
    leafId: Type.Optional(
      Type.String({ description: "Search branch ending at this leaf id" }),
    ),
    limit: Type.Optional(Type.Number()),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
    const targetSessionPath = await getTargetSessionPath(ctx);
    const sm = SessionManager.open(targetSessionPath);
    const entries =
      params.scope === "full_tree"
        ? sm.getEntries()
        : sm.getBranch(params.leafId);
    const currentBranchIds = new Set(sm.getBranch().map((e) => e.id));
    const limit = params.limit && params.limit > 0 ? params.limit : 20;

    const matches = entries
      .map((entry) => ({ entry, text: entrySearchText(entry) }))
      .filter(({ text }) =>
        text.toLowerCase().includes(params.query.toLowerCase()),
      )
      .slice(0, limit)
      .map(({ entry, text }) => ({
        ...compactEntry(
          entry,
          sm.getLabel(entry.id),
          sm.getChildren(entry.id).length,
          currentBranchIds.has(entry.id),
        ),
        snippet: snippetFor(text, params.query),
      }));

    return {
      content: [{ type: "text", text: JSON.stringify(matches) }],
      details: { matches },
    };
  },
});
