import type { LoadExtensionsResult } from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "../types";

/**
 * Collect promptGuidelines from the subagent's tool sources and format them
 * for injection into the system prompt via getAppendSystemPrompt().
 *
 * When Pi's buildSystemPrompt() receives a custom prompt, it skips the default
 * Guidelines section entirely — including tool promptGuidelines and promptSnippets.
 * By collecting them here and passing them through getAppendSystemPrompt(), we
 * restore that guidance in the subagent's system prompt.
 *
 * Guidelines are collected from two sources:
 * 1. Custom tools — SubagentToolSpec with type "custom" (definitions from .spec())
 * 2. Extension tools — discovered via extensionPaths (from LoadExtensionsResult)
 *
 * Note: Pi built-in native tool guidelines (read, edit, write) are collected by
 * Pi's _refreshToolRegistry() into systemPromptOptions.promptGuidelines, but
 * buildSystemPrompt() discards them in the custom prompt path. Since
 * createAllToolDefinitions() is not exported from the SDK, we cannot access
 * them here. The long-term fix should be in Pi itself — making buildSystemPrompt()
 * include promptGuidelines even in the customPrompt branch.
 */

/**
 * Collect promptGuidelines from custom tools and extension-discovered tools.
 */
export function collectSubagentToolGuidelines(
  tools: SubagentToolSpec[],
  cwd: string,
  extensionsResult?: LoadExtensionsResult,
): string[] {
  const guidelines: string[] = [];
  const seen = new Set<string>();

  // 1. Custom tools
  for (const tool of tools) {
    if (tool.type !== "custom") continue;
    const definition = tool.spec(cwd);
    addGuidelines(definition.promptGuidelines ?? [], guidelines, seen);
  }

  // 2. Extension-discovered tools
  if (extensionsResult) {
    for (const extension of extensionsResult.extensions) {
      for (const [, registeredTool] of extension.tools) {
        addGuidelines(
          registeredTool.definition.promptGuidelines ?? [],
          guidelines,
          seen,
        );
      }
    }
  }

  return guidelines;
}

function addGuidelines(
  raw: string[],
  guidelines: string[],
  seen: Set<string>,
): void {
  for (const guideline of raw) {
    const normalized = guideline.trim();
    if (normalized.length > 0 && !seen.has(normalized)) {
      seen.add(normalized);
      guidelines.push(normalized);
    }
  }
}

/**
 * Format collected guidelines as a section suitable for appendSystemPrompt.
 * Returns an empty array if there are no guidelines (avoids adding an empty heading).
 */
export function formatToolGuidelinesSection(guidelines: string[]): string[] {
  if (guidelines.length === 0) return [];

  return [
    ["## Tool usage guidelines", "", ...guidelines.map((g) => `- ${g}`)].join(
      "\n",
    ),
  ];
}
