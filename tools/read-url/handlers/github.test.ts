import { describe, expect, it } from "vitest";
import { detectCodeFenceLanguage, parseGitHubUrl } from "./github";

describe("github read_url handler", () => {
  it("parses repository URLs", () => {
    const parsed = parseGitHubUrl(
      new URL("https://github.com/aliou/pi-harness"),
    );

    expect(parsed).toEqual({
      owner: "aliou",
      repo: "pi-harness",
      kind: "repo",
    });
  });

  it("parses blob URLs", () => {
    const parsed = parseGitHubUrl(
      new URL(
        "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/preset.ts",
      ),
    );

    expect(parsed).toEqual({
      owner: "badlogic",
      repo: "pi-mono",
      ref: "main",
      path: "packages/coding-agent/examples/extensions/preset.ts",
      kind: "blob",
    });
  });

  it("parses tree URLs", () => {
    const parsed = parseGitHubUrl(
      new URL(
        "https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions",
      ),
    );

    expect(parsed).toEqual({
      owner: "badlogic",
      repo: "pi-mono",
      ref: "main",
      path: "packages/coding-agent/examples/extensions",
      kind: "tree",
    });
  });

  it("parses pull request URLs", () => {
    const parsed = parseGitHubUrl(
      new URL("https://github.com/badlogic/pi-mono/pull/123"),
    );

    expect(parsed).toEqual({
      owner: "badlogic",
      repo: "pi-mono",
      number: 123,
      kind: "pull",
    });
  });

  it("parses commit URLs", () => {
    const parsed = parseGitHubUrl(
      new URL(
        "https://github.com/badlogic/pi-mono/commit/0123456789abcdef0123456789abcdef01234567",
      ),
    );

    expect(parsed).toEqual({
      owner: "badlogic",
      repo: "pi-mono",
      sha: "0123456789abcdef0123456789abcdef01234567",
      kind: "commit",
    });
  });

  it("parses issue URLs", () => {
    const parsed = parseGitHubUrl(
      new URL("https://github.com/badlogic/pi-mono/issues/1"),
    );

    expect(parsed).toEqual({
      owner: "badlogic",
      repo: "pi-mono",
      number: 1,
      kind: "issue",
    });
  });

  it("maps file extensions to markdown code fences", () => {
    expect(detectCodeFenceLanguage("foo.ts")).toBe("ts");
    expect(detectCodeFenceLanguage("foo.tsx")).toBe("tsx");
    expect(detectCodeFenceLanguage("foo.yml")).toBe("yaml");
    expect(detectCodeFenceLanguage("foo.unknown")).toBe("text");
  });
});
