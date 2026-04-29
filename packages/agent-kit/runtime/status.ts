import type { SubagentDetails } from "./types";

const isSoleElement = <T>(arr: T[]): arr is [T] => arr.length === 1;

export function formatSubagentStatus(details: SubagentDetails) {
  if (details.thinking) {
    return "Thinking...";
  }

  const runningTools = details.toolCalls.filter(
    (toolCall) => toolCall.status === "running",
  );

  if (runningTools.length > 1) {
    return `Running ${runningTools.length} tools`;
  }

  if (isSoleElement(runningTools)) {
    return `Running ${runningTools[0].toolName}`;
  }

  return "Running...";
}
