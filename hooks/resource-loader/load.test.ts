import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appendLocalAgents, loadLocalAgentsFile } from "./load";

describe("resource-loader/load", () => {
  it("returns null when .agents/AGENTS.local.md is absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-"));
    try {
      expect(loadLocalAgentsFile(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads the file when present at cwd only", () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-"));
    try {
      const agentsDir = join(dir, ".agents");
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, "AGENTS.local.md"), "# local\nbody here");
      const result = loadLocalAgentsFile(dir);
      expect(result).not.toBeNull();
      expect(result?.path).toBe(join(agentsDir, "AGENTS.local.md"));
      expect(result?.content).toContain("body here");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not look in parent directories", () => {
    const parent = mkdtempSync(join(tmpdir(), "rl-"));
    const child = join(parent, "child");
    try {
      const agentsDir = join(parent, ".agents");
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, "AGENTS.local.md"), "parent body");
      // child dir exists but has no .agents
      expect(loadLocalAgentsFile(child)).toBeNull();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("appends content wrapped in Pi's <project_context> format", () => {
    const file = { path: "/x/.agents/AGENTS.local.md", content: "do X" };
    const next = appendLocalAgents("base prompt", file);
    expect(next).toContain("base prompt");
    expect(next).toContain("<project_context>");
    expect(next).toContain("</project_context>");
    expect(next).toContain(
      '<project_instructions path="/x/.agents/AGENTS.local.md">',
    );
    expect(next).toContain("do X");
  });

  it("escapes XML special chars in the path", () => {
    const file = { path: "/x & <y>/AGENTS.local.md", content: "body" };
    const next = appendLocalAgents("base", file);
    expect(next).toContain("&amp;");
    expect(next).toContain("&lt;y&gt;");
  });

  it("leaves the prompt unchanged when file is null or empty", () => {
    expect(appendLocalAgents("base", null)).toBe("base");
    expect(appendLocalAgents("base", { path: "/x", content: "   \n  " })).toBe(
      "base",
    );
  });
});
