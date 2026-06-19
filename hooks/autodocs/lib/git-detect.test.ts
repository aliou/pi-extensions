import { describe, expect, it } from "vitest";
import { couldAdvanceMain } from "./git-detect";

describe("couldAdvanceMain", () => {
  describe("advancing subcommands", () => {
    const advancing = [
      'git commit -m "feat: add thing"',
      "git merge feature-branch",
      "git rebase main",
      "git pull",
      "git pull --rebase origin main",
      "git push origin main",
      "git push",
      "git fetch origin",
      "git reset --hard origin/main",
      "git cherry-pick abc1234",
      "git revert abc1234",
      "git switch main",
      "git checkout main",
    ];

    for (const cmd of advancing) {
      it(`detects: ${cmd}`, () => {
        expect(couldAdvanceMain(cmd)).toBe(true);
      });
    }
  });

  describe("non-advancing commands", () => {
    const nonAdvancing = [
      "git status",
      "git log --oneline",
      "git diff",
      "git diff --stat",
      "git add -A",
      "git add .",
      "git stash",
      "git branch --show-current",
      "git tag v1.0",
      "git show HEAD",
      "git rev-parse --short HEAD",
      "echo hello",
      "ls -la",
      "npm test",
      "pnpm typecheck",
      "",
    ];

    for (const cmd of nonAdvancing) {
      it(`skips: ${cmd || "(empty)"}`, () => {
        expect(couldAdvanceMain(cmd)).toBe(false);
      });
    }
  });

  describe("composite commands", () => {
    it("detects advancement in a logical AND", () => {
      expect(
        couldAdvanceMain('git commit -m "x" && git push origin main'),
      ).toBe(true);
    });

    it("detects advancement after a cd", () => {
      expect(couldAdvanceMain("cd ../other && git pull")).toBe(true);
    });

    it("does not flag a pipeline of non-advancing git ops", () => {
      expect(couldAdvanceMain("git status | grep main")).toBe(false);
    });

    it("flags a pipeline that contains an advancing op", () => {
      expect(couldAdvanceMain("echo bump && git push")).toBe(true);
    });

    it("handles flags between git and the subcommand", () => {
      expect(couldAdvanceMain("git -C ../repo pull")).toBe(true);
      expect(couldAdvanceMain("git -C ../repo status")).toBe(false);
    });
  });

  describe("quoting", () => {
    it("handles single-quoted message", () => {
      expect(couldAdvanceMain("git commit -m 'fix: thing'")).toBe(true);
    });

    it("handles double-quoted message", () => {
      expect(couldAdvanceMain('git commit -m "fix: thing"')).toBe(true);
    });
  });

  describe("robustness", () => {
    it("returns true for unparseable git commands (regex fallback)", () => {
      expect(couldAdvanceMain("git commit -m ")).toBe(true);
    });

    it("returns false for non-git unparseable input", () => {
      expect(couldAdvanceMain(") ( broken")).toBe(false);
    });
  });
});
