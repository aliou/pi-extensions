import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { truncate } from "@harness/utils";
import { Type } from "typebox";
import {
  SESSION_TITLE_CHANGE_TYPE,
  type SessionTitleChangeCustomEntry,
} from "../constants";

export function createSessionTitleTools(pi: ExtensionAPI): SubagentToolSpec[] {
  return [
    {
      name: "set_title",
      type: "custom",
      spec: () =>
        defineTool({
          name: "set_title",
          label: "Set Title",
          description: "Set the current Pi session title.",
          parameters: Type.Object({
            title: Type.String({
              description: "The session title to set.",
            }),
          }),

          async execute(_toolCallId, params) {
            const previousTitle = pi.getSessionName();
            const title = truncate(params.title.trim(), 80);
            pi.setSessionName(title);

            if (previousTitle !== title) {
              pi.appendEntry<SessionTitleChangeCustomEntry>(
                SESSION_TITLE_CHANGE_TYPE,
                { previousTitle, title },
              );
            }

            return {
              content: [{ type: "text", text: title }],
              details: { title, previousTitle },
            };
          },
        }),
    },
  ];
}
