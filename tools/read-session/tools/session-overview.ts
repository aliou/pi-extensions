import { defineTool, SessionManager } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { getTargetSessionPath } from "./utils";

export const sessionOverview = defineTool({
  name: "get_session_overview",
  label: "Get Session Overview",
  description: "Get an overview of a session",
  parameters: Type.Object({}),
  execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) => {
    const sessionPath = await getTargetSessionPath(ctx);
    const sm = SessionManager.open(sessionPath);
    const entries = sm.getEntries();

    const overview = {
      id: sm.getSessionId(),
      cwd: sm.getCwd(),
      name: sm.getSessionName(),
      created: sm.getHeader()?.timestamp,
      messageCount: entries.filter(
        (e) => e.type === "message" || e.type === "custom_message",
      ).length,
      compactionCount: entries.filter((e) => e.type === "compaction").length,
      parentSessionPath: sm.getHeader()?.parentSession,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(overview) }],
      details: { overview },
    };
  },
});
