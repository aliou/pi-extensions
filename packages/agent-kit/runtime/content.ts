import type { TextContent } from "@earendil-works/pi-ai";

export function textContent(text: string): TextContent {
  return { type: "text", text };
}

export function appendSubagentSessionFooter(
  text: string,
  toolName: string,
  sessionId: string,
) {
  return `${text}

---
Subagent session:
- sessionId: ${sessionId}

To continue this session, call resume_${toolName} with this sessionId.`;
}
