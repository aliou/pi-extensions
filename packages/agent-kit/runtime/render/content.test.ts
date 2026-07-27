import type {
  AgentToolResult,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { Text, visibleWidth } from "@earendil-works/pi-tui";
import { NOOP_THEME } from "@harness/test-utils/theme";
import { beforeAll, describe, expect, it } from "vitest";
import type { SubagentConfig } from "../../types";
import type { SubagentDetails } from "../types";
import { renderSubagentResult } from "./content";
import type { ToolRenderContext } from "./types";

const WIDTH = 24;

const details = {
  status: "running",
  activity: [
    {
      type: "thinking",
      startedAt: 0,
      endedAt: null,
      content: "First reasoning paragraph.\n\nSecond reasoning paragraph.",
    },
    { type: "tool_call", toolCallId: "tool-1", startedAt: 1 },
  ],
  toolCalls: [
    {
      toolCallId: "tool-1",
      toolName: "demo",
      args: {},
      status: "running",
      startedAt: 1,
      endedAt: null,
      error: null,
    },
  ],
  usage: { cost: { total: 0 } },
  responseTokens: 0,
  startedAt: 0,
  endedAt: null,
} as SubagentDetails;

const config = {
  tools: [
    {
      name: "demo",
      type: "native",
      render: () =>
        new Text(
          "Tool summary with a long description.\nFull tool detail.",
          0,
          0,
        ),
    },
  ],
} as unknown as SubagentConfig;

const result = { details, content: [] } as unknown as AgentToolResult<unknown>;
const ctx = { cwd: "/tmp/project" } as ToolRenderContext;

function render(expanded: boolean) {
  const options = { expanded, isPartial: true } as ToolRenderResultOptions;
  return renderSubagentResult(config, result, options, NOOP_THEME, ctx).render(
    WIDTH,
  );
}

describe("renderSubagentResult activity", () => {
  beforeAll(() => {
    initTheme("dark", false);
  });

  it("renders each collapsed activity item on one bounded line", () => {
    const lines = render(false).filter((line) => line.trim().length > 0);
    const activityLines = lines.slice(0, 2);

    expect(activityLines).toHaveLength(2);
    expect(activityLines.every((line) => visibleWidth(line) <= WIDTH)).toBe(
      true,
    );
    expect(activityLines.every((line) => line.includes("…"))).toBe(true);
  });

  it("keeps full reasoning and tool details when expanded", () => {
    const output = render(true)
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");

    expect(output).toContain("Second reasoning paragraph.");
    expect(output).toContain("Full tool detail.");
  });
});
