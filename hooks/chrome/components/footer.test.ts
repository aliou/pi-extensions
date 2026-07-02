import type {
  ExtensionAPI,
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { AD_TPS_TELEMETRY_EVENT } from "@harness/events";
import { afterEach, describe, expect, it, vi } from "vitest";

// Avoid real fs watchers and git subprocesses in the render test.
vi.mock("../lib/git-status", () => ({
  GitStatusWatcher: class {
    getStatus() {
      return { dirty: false, ahead: 0, behind: 0 };
    }
    dispose() {}
  },
}));

import { createCustomFooter } from "./footer";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

const footerData = {
  getGitBranch: () => null,
  getExtensionStatuses: () => new Map<string, string>(),
  getAvailableProviderCount: () => 1,
  onBranchChange: () => () => {},
} as unknown as ReadonlyFooterDataProvider;

interface Captured {
  render(width: number): string[];
  dispose(): void;
}

interface Fixture {
  component: Captured;
  dispose: () => void;
}

/**
 * Build a footer against the production crash inputs: a turn that streamed at
 * 142.0 tps with branch cost $0.009 and total cost $0.140, context 5% of a
 * 200k window, model glm-5.2-short.
 */
function createFixture(
  options: {
    showResumeCacheFreshness?: boolean;
    compactedAfterAssistant?: boolean;
  } = {},
): Fixture {
  // First assistant entry is the branch leaf; getBranch() returns it so
  // branchCost diverges from totalCost and the stats line carries the
  // cumulative parenthetical — exactly the crashing output.
  const branchEntry = {
    type: "message",
    timestamp: new Date(0).toISOString(),
    message: {
      role: "assistant",
      api: "openai-completions",
      provider: "synthetic",
      model: "hf:zai-org/GLM-4.7-Flash",
      timestamp: 0,
      usage: {
        input: 100,
        cacheRead: 0,
        cacheWrite: 0,
        cost: { total: 0.009 },
      },
    },
  };
  const totalEntry = {
    type: "message",
    message: {
      role: "assistant",
      usage: { input: 100, cacheRead: 0, cacheWrite: 0, cost: { total: 0.14 } },
    },
  };
  const compactionEntry = {
    type: "compaction",
    timestamp: new Date(1_000).toISOString(),
    summary: "summary",
    firstKeptEntryId: "assistant-entry",
    tokensBefore: 10_000,
  };
  const branchEntries = options.compactedAfterAssistant
    ? [branchEntry, compactionEntry]
    : [branchEntry];

  const handlers = new Map<string, ((data: unknown) => void)[]>();
  const pi = {
    events: {
      on: vi.fn((event: string, handler: (data: unknown) => void) => {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      }),
    },
    getThinkingLevel: vi.fn(() => "off"),
  } as unknown as ExtensionAPI;

  let captured: Captured | undefined;
  const ctx = {
    model: {
      id: "glm-5.2-short",
      provider: "zai",
      contextWindow: 200_000,
      reasoning: false,
    },
    sessionManager: {
      getSessionName: () => undefined,
      getEntries: () => [branchEntry, totalEntry],
      getBranch: () => branchEntries,
    },
    getContextUsage: () => ({
      contextWindow: 200_000,
      percent: 5,
      tokens: 9999,
    }),
    ui: {
      setFooter: (
        factory?: (
          tui: unknown,
          thm: Theme,
          data: ReadonlyFooterDataProvider,
        ) => Captured,
      ) => {
        // cleanup() calls setFooter(undefined) to restore the default footer.
        if (typeof factory === "function") {
          captured = factory({}, theme, footerData);
        }
      },
    },
  } as unknown as ExtensionContext;

  const footer = createCustomFooter(pi);
  footer.setup(ctx, {
    showResumeCacheFreshness: options.showResumeCacheFreshness === true,
  });

  // Feed the crashing TPS telemetry. Emitted before setup set ctx, but the
  // handler records latestTps before the early `if (!ctx) return` guard.
  for (const handler of handlers.get(AD_TPS_TELEMETRY_EVENT) ?? []) {
    handler({ tps: 142.0 });
  }

  if (!captured) throw new Error("footer component was not captured");
  const component = captured;

  return {
    component,
    dispose: () => {
      component.dispose?.();
      footer.cleanup();
    },
  };
}

describe("custom footer width safety", () => {
  let fixture: Fixture;
  afterEach(() => fixture?.dispose());

  it("never emits a line wider than the terminal at width 40 (crash regression)", () => {
    fixture = createFixture();
    const lines = fixture.component.render(40);
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(40);
    }
  });

  it("truncates hard when the stats line still exceeds a very narrow terminal", () => {
    fixture = createFixture();
    const lines = fixture.component.render(10);
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(10);
    }
  });

  it("keeps cache percent in the model cache segment", () => {
    fixture = createFixture({ showResumeCacheFreshness: true });
    const lines = fixture.component.render(120);

    expect(lines[1]).toContain("cache 0% ×");
    expect(lines[1]).not.toContain("cache stale");
  });

  it("shows unknown cache after compaction without a newer assistant", () => {
    fixture = createFixture({
      showResumeCacheFreshness: true,
      compactedAfterAssistant: true,
    });
    const lines = fixture.component.render(120);

    expect(lines[1]).toContain("cache ?");
    expect(lines[1]).not.toContain("cache 0%");
  });
});
