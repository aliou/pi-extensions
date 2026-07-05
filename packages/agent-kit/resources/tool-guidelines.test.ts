import type {
  LoadExtensionsResult,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { SubagentToolSpec } from "../types";
import {
  collectSubagentToolGuidelines,
  collectSubagentToolSnippets,
  formatToolGuidelinesSection,
  formatToolSnippetsSection,
} from "./tool-guidelines";

function makeCustomTool(
  name: string,
  promptGuidelines?: string[],
): SubagentToolSpec {
  const definition = {
    name,
    label: name,
    description: `Test tool ${name}`,
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async () => ({ content: [], details: undefined }),
    ...(promptGuidelines ? { promptGuidelines } : {}),
  } as unknown as ToolDefinition;

  return {
    name,
    type: "custom",
    spec: () => definition,
  };
}

function makeCustomToolWithSnippet(
  name: string,
  snippet: string,
): SubagentToolSpec {
  const definition = {
    name,
    label: name,
    description: `Test tool ${name}`,
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async () => ({ content: [], details: undefined }),
    promptSnippet: snippet,
  } as unknown as ToolDefinition;

  return { name, type: "custom", spec: () => definition };
}

function makeExtensionsResultWithSnippet(
  name: string,
  snippet: string,
): LoadExtensionsResult {
  return makeExtensionsResult({}, { name, snippet });
}

function makeNativeTool(name: string): SubagentToolSpec {
  return { name, type: "native" };
}

function makeExtensionsResult(
  toolGuidelines: Record<string, string[]>,
  toolSnippet?: { name: string; snippet: string },
): LoadExtensionsResult {
  const names = new Set<string>([
    ...Object.keys(toolGuidelines),
    ...(toolSnippet ? [toolSnippet.name] : []),
  ]);
  const extensions = Array.from(names).map((name) => {
    const guidelines = toolGuidelines[name] ?? [];
    const tools = new Map<string, { definition: ToolDefinition }>();
    tools.set(name, {
      definition: {
        name,
        label: name,
        description: `Extension tool ${name}`,
        parameters: { type: "object", properties: {} },
        execute: async () => ({ content: [], details: undefined }),
        promptGuidelines: guidelines,
        ...(toolSnippet && toolSnippet.name === name
          ? { promptSnippet: toolSnippet.snippet }
          : {}),
      } as unknown as ToolDefinition,
    });

    return {
      path: `/ext/${name}`,
      resolvedPath: `/ext/${name}`,
      sourceInfo: {
        source: "test",
        path: `/ext/${name}`,
        scope: "extension" as const,
        origin: "local" as const,
      },
      handlers: new Map<string, never[]>(),
      tools,
      messageRenderers: new Map<string, never[]>(),
      commands: new Map<string, never[]>(),
      flags: new Map<string, never[]>(),
      shortcuts: new Map<string, never[]>(),
    };
  });

  return {
    extensions,
    errors: [],
    runtime: {
      flagValues: new Map(),
      pendingProviderRegistrations: [],
      assertActive: () => {},
      invalidate: () => {},
      registerProvider: () => {},
      unregisterProvider: () => {},
      sendMessage: () => {},
      sendUserMessage: () => {},
      appendEntry: () => {},
      setSessionName: () => {},
      getSessionName: () => undefined,
      setLabel: () => {},
      getActiveTools: () => [],
      getAllTools: () => [],
      setActiveTools: () => {},
      refreshTools: () => {},
      getCommands: () => [],
      setModel: async () => false,
      getThinkingLevel: () => "medium" as const,
      setThinkingLevel: () => {},
      cycleThinkingLevel: () => undefined,
      newSession: async () => ({ cancelled: false }),
      fork: async () => ({ cancelled: false }),
      switchSession: async () => ({ cancelled: false }),
      reload: async () => {},
      events: {
        on: () => {},
        off: () => {},
        once: () => {},
        emit: () => {},
      } as never,
    },
  } as unknown as LoadExtensionsResult;
}

describe("collectSubagentToolGuidelines", () => {
  it("collects guidelines from custom tools", () => {
    const tools: SubagentToolSpec[] = [
      makeCustomTool("tool_a", ["Use tool_a for X", "Do not use tool_a for Y"]),
      makeCustomTool("tool_b", ["Use tool_b for Z"]),
    ];

    const result = collectSubagentToolGuidelines(tools, "/tmp");

    expect(result).toEqual([
      "Use tool_a for X",
      "Do not use tool_a for Y",
      "Use tool_b for Z",
    ]);
  });

  it("collects guidelines from extensions result", () => {
    const tools: SubagentToolSpec[] = [];

    const extensionsResult = makeExtensionsResult({
      grep: ["Prefer grep over bash for searching"],
      find: ["Use find instead of shell find"],
    });

    const result = collectSubagentToolGuidelines(
      tools,
      "/tmp",
      extensionsResult,
    );

    expect(result).toEqual([
      "Prefer grep over bash for searching",
      "Use find instead of shell find",
    ]);
  });

  it("deduplicates guidelines across custom and extension tools", () => {
    const tools: SubagentToolSpec[] = [
      makeCustomTool("tool_a", ["Be concise"]),
    ];

    const extensionsResult = makeExtensionsResult({
      tool_b: ["Be concise", "Be specific"],
    });

    const result = collectSubagentToolGuidelines(
      tools,
      "/tmp",
      extensionsResult,
    );

    expect(result).toEqual(["Be concise", "Be specific"]);
  });

  it("skips blank guidelines", () => {
    const tools: SubagentToolSpec[] = [
      makeCustomTool("tool_a", ["  ", "", "Use tool_a"]),
    ];

    const result = collectSubagentToolGuidelines(tools, "/tmp");

    expect(result).toEqual(["Use tool_a"]);
  });

  it("returns empty array when no tools have guidelines", () => {
    const tools: SubagentToolSpec[] = [
      makeNativeTool("ls"),
      makeCustomTool("tool_a"),
    ];

    const result = collectSubagentToolGuidelines(tools, "/tmp");

    expect(result).toEqual([]);
  });

  it("collects guidelines from Pi built-in native tools", () => {
    const tools: SubagentToolSpec[] = [makeNativeTool("read")];

    const result = collectSubagentToolGuidelines(tools, "/tmp");

    // read is a Pi built-in with a promptGuideline; it should now be included.
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((g) => g.toLowerCase().includes("read"))).toBe(true);
  });

  it("prefers extension tool guidelines over Pi built-in for the same name", () => {
    const tools: SubagentToolSpec[] = [makeNativeTool("read")];

    const extensionsResult = makeExtensionsResult({
      read: ["Extension override guideline for read"],
    });

    const result = collectSubagentToolGuidelines(
      tools,
      "/tmp",
      extensionsResult,
    );

    expect(result).toEqual(["Extension override guideline for read"]);
  });
});

describe("collectSubagentToolSnippets", () => {
  it("collects snippets from custom + extension + Pi built-in tools in tool order", () => {
    const tools: SubagentToolSpec[] = [
      makeCustomToolWithSnippet("git_log", "Search local git history"),
      makeNativeTool("read"),
      makeNativeTool("unknown_tool"),
    ];

    const result = collectSubagentToolSnippets(tools, "/tmp");

    expect(result).toEqual([
      "- git_log: Search local git history",
      // read is a Pi built-in; its snippet comes from createReadToolDefinition.
      expect.stringContaining("read"),
    ]);
  });

  it("prefers extension snippet over Pi built-in for the same name", () => {
    const tools: SubagentToolSpec[] = [makeNativeTool("read")];

    const extensionsResult = makeExtensionsResultWithSnippet(
      "read",
      "Extension read snippet",
    );

    const result = collectSubagentToolSnippets(tools, "/tmp", extensionsResult);

    expect(result).toEqual(["- read: Extension read snippet"]);
  });

  it("skips custom tools without a snippet and dedupes by name", () => {
    const tools: SubagentToolSpec[] = [
      makeCustomToolWithSnippet("tool_a", "Snippet A"),
      makeCustomToolWithSnippet("tool_a", "Snippet A dup"),
      makeCustomTool("tool_b"), // no snippet
    ];

    const result = collectSubagentToolSnippets(tools, "/tmp");

    expect(result).toEqual(["- tool_a: Snippet A"]);
  });

  it("returns empty array when no tools have snippets", () => {
    const tools: SubagentToolSpec[] = [
      makeCustomTool("tool_a"),
      makeNativeTool("unknown_tool"),
    ];

    const result = collectSubagentToolSnippets(tools, "/tmp");

    expect(result).toEqual([]);
  });
});

describe("formatToolSnippetsSection", () => {
  it("formats snippets as a markdown section", () => {
    const result = formatToolSnippetsSection([
      "- read: Read file contents",
      "- git_log: Search local git history",
    ]);

    expect(result).toBe(
      "## Available tools\n\n- read: Read file contents\n- git_log: Search local git history",
    );
  });

  it("returns empty string for no snippets", () => {
    const result = formatToolSnippetsSection([]);

    expect(result).toBe("");
  });
});

describe("formatToolGuidelinesSection", () => {
  it("formats guidelines as a markdown section", () => {
    const result = formatToolGuidelinesSection([
      "Use read for files",
      "Be concise",
    ]);

    expect(result).toEqual([
      "## Tool usage guidelines\n\n- Use read for files\n- Be concise",
    ]);
  });

  it("returns empty array for no guidelines", () => {
    const result = formatToolGuidelinesSection([]);

    expect(result).toEqual([]);
  });
});
