import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectSplitEnvironment, parseHerdrPaneId } from "./editor";

describe("detectSplitEnvironment", () => {
  beforeEach(() => {
    vi.stubEnv("TMUX", "");
    vi.stubEnv("HERDR_ENV", "");
    vi.stubEnv("HERDR_PANE_ID", "");
    vi.stubEnv("TERM_PROGRAM", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers tmux when environments are nested", () => {
    vi.stubEnv("TMUX", "/tmp/tmux.sock");
    vi.stubEnv("HERDR_ENV", "1");
    vi.stubEnv("HERDR_PANE_ID", "w1:p1");
    vi.stubEnv("TERM_PROGRAM", "ghostty");

    expect(detectSplitEnvironment()).toBe("tmux");
  });

  it("detects Herdr before its outer terminal", () => {
    vi.stubEnv("HERDR_ENV", "1");
    vi.stubEnv("HERDR_PANE_ID", "w1:p1");
    vi.stubEnv("TERM_PROGRAM", "ghostty");

    expect(detectSplitEnvironment()).toBe("herdr");
  });

  it("requires a Herdr pane id", () => {
    vi.stubEnv("HERDR_ENV", "1");

    expect(detectSplitEnvironment()).toBe("unknown");
  });
});

describe("parseHerdrPaneId", () => {
  it("reads the pane id from a split response", () => {
    const stdout = JSON.stringify({
      result: { type: "pane_split", pane: { pane_id: "w1:p2" } },
    });

    expect(parseHerdrPaneId(stdout)).toBe("w1:p2");
  });

  it.each([
    "",
    "not json",
    "{}",
    '{"result":{"pane":{}}}',
  ])("rejects an invalid split response: %s", (stdout) => {
    expect(parseHerdrPaneId(stdout)).toBeNull();
  });
});
