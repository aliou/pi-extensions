import { defineTool, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import type { SubagentToolSpec } from "../../../packages/agent-kit/types";

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
            const title = params.title.trim().slice(0, 80);
            pi.setSessionName(title);

            return {
              content: [{ type: "text" as const, text: title }],
              details: { title },
            };
          },
        }),
    },
  ];
}
