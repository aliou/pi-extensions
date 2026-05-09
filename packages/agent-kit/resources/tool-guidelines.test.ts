import type {
  LoadExtensionsResult,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { SubagentToolSpec } from "../types";
import {
  collectSubagentToolGuidelines,
  formatToolGuidelinesSection,
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

function makeNativeTool(name: string): SubagentToolSpec {
  return { name, type: "native" };
}

function makeExtensionsResult(
  toolGuidelines: Record<string, string[]>,
): LoadExtensionsResult {
  const extensions = Object.entries(toolGuidelines).map(
    ([name, guidelines]) => {
      const tools = new Map<string, { definition: ToolDefinition }>();
      tools.set(name, {
        definition: {
          name,
          label: name,
          description: `Extension tool ${name}`,
          parameters: { type: "object", properties: {} },
          execute: async () => ({ content: [], details: undefined }),
          promptGuidelines: guidelines,
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
    },
  );

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
      makeNativeTool("read"),
      makeCustomTool("tool_a"),
    ];

    const result = collectSubagentToolGuidelines(tools, "/tmp");

    expect(result).toEqual([]);
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
