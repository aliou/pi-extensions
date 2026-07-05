import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

/**
 * Subagent tool-prompt injector.
 *
 * Pi's buildSystemPrompt() skips the "Available tools" list and the tool
 * promptGuidelines when a custom system prompt is used (the subagent branch).
 * This handler reads those values back off `event.systemPromptOptions` — which
 * Pi already populated from the full tool registry (built-in + extension +
 * custom tools, filtered to the subagent's active tool set) — and appends them
 * to the subagent's system prompt as "## Available tools" and
 * "## Tool usage guidelines" sections.
 *
 * Fires once per turn; idempotent because it appends to the stable base prompt.
 * Loaded only by subagents (via DEFAULT_SUBAGENT_EXTENSION_PATHS); the main
 * session uses the default-prompt branch which already renders these sections.
 */
export default function subagentToolPrompt(pi: ExtensionAPI): void {
  pi.on(
    "before_agent_start",
    async (
      event: BeforeAgentStartEvent,
    ): Promise<BeforeAgentStartEventResult | undefined> => {
      const { systemPrompt, systemPromptOptions } = event;
      const { toolSnippets = {}, promptGuidelines = [] } = systemPromptOptions;

      const sections: string[] = [];

      const snippetLines = Object.entries(toolSnippets).map(
        ([name, snippet]) => `- ${name}: ${snippet}`,
      );
      if (snippetLines.length > 0) {
        sections.push(["## Available tools", "", ...snippetLines].join("\n"));
      }

      if (promptGuidelines.length > 0) {
        sections.push(
          [
            "## Tool usage guidelines",
            "",
            ...promptGuidelines.map((g) => `- ${g}`),
          ].join("\n"),
        );
      }

      if (sections.length === 0) return undefined;
      return { systemPrompt: `${systemPrompt}\n\n${sections.join("\n\n")}` };
    },
  );
}
