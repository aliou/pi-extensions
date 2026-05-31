import { defineTool } from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { Type } from "typebox";

export function createCompactionTools(
  onSummary: (summary: string) => void,
): SubagentToolSpec[] {
  return [
    {
      name: "submit_summary",
      type: "custom",
      spec: () =>
        defineTool({
          name: "submit_summary",
          label: "Submit Summary",
          description:
            "Submit the structured conversation summary. You MUST call this tool exactly once with your summary.",
          parameters: Type.Object({
            summary: Type.String({
              description: "The structured summary of the conversation.",
            }),
          }),
          async execute(_toolCallId, params) {
            onSummary(params.summary.trim());

            return {
              content: [
                { type: "text", text: `Summary: ${params.summary.trim()}` },
              ],
              details: { summary: params.summary.trim() },
            };
          },
        }),
    },
  ];
}
