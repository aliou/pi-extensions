import {
  type AssistantMessage,
  isContextOverflow,
} from "@earendil-works/pi-ai";

export function buildBlankResponseError(
  message: AssistantMessage | undefined,
  subagentName: string,
): string {
  const providerError = message?.errorMessage?.trim();
  const base =
    providerError ||
    (message
      ? `Subagent stopped with reason "${message.stopReason}" and produced no response.`
      : "No response from subagent.");

  if (!message || !isContextOverflow(message)) return base;

  return `${base} Start a new ${subagentName} call with a narrower scope; do not call resume_${subagentName} because this session retains the oversized context.`;
}
