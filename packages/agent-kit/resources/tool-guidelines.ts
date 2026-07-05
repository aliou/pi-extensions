import type { LoadExtensionsResult } from "@earendil-works/pi-coding-agent";
import {
  createBashToolDefinition,
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "../types";

/**
 * Collect promptSnippets and promptGuidelines from the subagent's tool sources
 * and format them for injection into the system prompt via getAppendSystemPrompt().
 *
 * When Pi's buildSystemPrompt() receives a custom prompt, it skips the default
 * "Available tools" list AND the Guideline section entirely — including tool
 * promptGuidelines and promptSnippets that the tool registry already collected.
 * By collecting them here and passing them through getAppendSystemPrompt(), we
 * restore that guidance in the subagent's system prompt.
 *
 * Snippets and guidelines are resolved, in priority order, from three sources:
 * 1. Custom tools — SubagentToolSpec with type "custom" (definitions from .spec())
 * 2. Extension tools — discovered via extensionPaths (from LoadExtensionsResult)
 * 3. Pi built-in native tools — ls, find, grep, read, bash, edit, write (their
 *    ToolDefinitions are reconstructed here via the exported create*ToolDefinition
 *    creators, since Pi discards them in the custom-prompt path and does not
 *    expose the base registry to resource loaders).
 *
 * Tool order follows the subagent's `tools` declaration order, which is the
 * order the author intends the model to see them.
 */

// ---------------------------------------------------------------------------
// Pi built-in native tool definitions (lazy, cached).
// Snippets and guidelines are static strings; cwd does not affect them.
// ---------------------------------------------------------------------------
let builtinToolDefsCache:
  | Array<{ name: string; snippet?: string; guidelines: string[] }>
  | undefined;

function getBuiltinToolDefs(): Array<{
  name: string;
  snippet?: string;
  guidelines: string[];
}> {
  if (builtinToolDefsCache) return builtinToolDefsCache;
  const cwd = process.cwd();
  const defs = [
    createReadToolDefinition(cwd),
    createBashToolDefinition(cwd),
    createEditToolDefinition(cwd),
    createWriteToolDefinition(cwd),
    createGrepToolDefinition(cwd),
    createFindToolDefinition(cwd),
    createLsToolDefinition(cwd),
  ];
  builtinToolDefsCache = defs.map((d) => ({
    name: d.name,
    snippet: d.promptSnippet?.trim() || undefined,
    guidelines: (d.promptGuidelines ?? []).map((g) => g.trim()).filter(Boolean),
  }));
  return builtinToolDefsCache;
}

function getBuiltinSnippet(name: string): string | undefined {
  return getBuiltinToolDefs().find((d) => d.name === name)?.snippet;
}

function getBuiltinGuidelines(name: string): string[] {
  return getBuiltinToolDefs().find((d) => d.name === name)?.guidelines ?? [];
}

/**
 * Collect promptGuidelines from custom tools, extension-discovered tools, and
 * Pi built-in native tools (filtered to those the subagent actually declares).
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
  const extensionGuidelinesByName = new Map<string, string[]>();
  if (extensionsResult) {
    for (const extension of extensionsResult.extensions) {
      for (const [name, registeredTool] of extension.tools) {
        const extGuidelines = registeredTool.definition.promptGuidelines ?? [];
        extensionGuidelinesByName.set(name, extGuidelines);
        addGuidelines(extGuidelines, guidelines, seen);
      }
    }
  }

  // 3. Pi built-in native tools (skip those shadowed by an extension override)
  for (const tool of tools) {
    if (tool.type !== "native") continue;
    if (extensionGuidelinesByName.has(tool.name)) continue; // extension wins
    addGuidelines(getBuiltinGuidelines(tool.name), guidelines, seen);
  }

  return guidelines;
}

/**
 * Collect promptSnippets as formatted "Available tools" lines, in the
 * subagent's declared tool order. Returns lines like "- name: snippet".
 */
export function collectSubagentToolSnippets(
  tools: SubagentToolSpec[],
  cwd: string,
  extensionsResult?: LoadExtensionsResult,
): string[] {
  const extensionSnippets = new Map<string, string>();
  if (extensionsResult) {
    for (const extension of extensionsResult.extensions) {
      for (const [name, registeredTool] of extension.tools) {
        const snippet = registeredTool.definition.promptSnippet?.trim();
        if (snippet) extensionSnippets.set(name, snippet);
      }
    }
  }

  const lines: string[] = [];
  const seen = new Set<string>();

  for (const tool of tools) {
    if (seen.has(tool.name)) continue;

    let snippet: string | undefined;
    if (tool.type === "custom") {
      snippet = tool.spec(cwd).promptSnippet?.trim();
    } else {
      // native: prefer extension-registered override, else Pi built-in
      snippet =
        extensionSnippets.get(tool.name) ?? getBuiltinSnippet(tool.name);
    }

    if (snippet) {
      seen.add(tool.name);
      lines.push(`- ${tool.name}: ${snippet}`);
    }
  }

  return lines;
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
 * Format collected snippets as an "Available tools" section. Returns an empty
 * string if there are no snippets (avoids adding an empty heading).
 */
export function formatToolSnippetsSection(snippets: string[]): string {
  if (snippets.length === 0) return "";
  return ["## Available tools", "", ...snippets].join("\n");
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
