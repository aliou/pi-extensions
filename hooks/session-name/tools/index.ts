import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { truncate } from "@harness/utils";
import { Type } from "typebox";
import {
  SESSION_NAME_CHANGE_TYPE,
  type SessionNameChangeCustomEntry,
} from "../constants";

export function createSessionNameTools(pi: ExtensionAPI): SubagentToolSpec[] {
  return [
    {
      name: "set_name",
      type: "custom",
      spec: () =>
        defineTool({
          name: "set_name",
          label: "Set Name",
          description: "Set the current Pi session name.",
          parameters: Type.Object({
            name: Type.String({
              description: "The session name to set.",
            }),
          }),

          async execute(_toolCallId, params) {
            const previousName = pi.getSessionName();
            const name = truncate(params.name.trim(), 80);
            pi.setSessionName(name);

            if (previousName !== name) {
              pi.appendEntry<SessionNameChangeCustomEntry>(
                SESSION_NAME_CHANGE_TYPE,
                { previousName, name },
              );
            }

            return {
              content: [{ type: "text", text: name }],
              details: { name, previousName },
            };
          },
        }),
    },
  ];
}
