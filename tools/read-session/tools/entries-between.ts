import { defineTool, SessionManager } from "@earendil-works/pi-coding-agent";
import {
  createSessionViewFromSession,
  getEntriesBetween,
} from "@harness/session-tools";
import { Type } from "typebox";
import { getTargetSessionPath } from "./utils";

export const entriesBetween = defineTool({
  name: "get_entries_between",
  label: "Get Entries Between",
  description:
    "Get compact entries on the main branch between two entry ids. Returns previews only.",
  parameters: Type.Object({
    startId: Type.String({ description: "First entry id to include" }),
    endId: Type.Optional(
      Type.String({
        description: "Last entry id to include; defaults to main branch leaf",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: "Maximum entries to return; defaults to 100",
      }),
    ),
    fromEnd: Type.Optional(
      Type.Boolean({ description: "Return newest entries first" }),
    ),
    types: Type.Optional(Type.Array(Type.String())),
    roles: Type.Optional(Type.Array(Type.String())),
  }),
  execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
    const targetSessionPath = await getTargetSessionPath(ctx);
    const sm = SessionManager.open(targetSessionPath);
    const result = getEntriesBetween(createSessionViewFromSession(sm), params);

    return {
      content: [{ type: "text", text: JSON.stringify(result.entries) }],
      details: result,
    };
  },
});
