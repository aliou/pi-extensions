import { describe, expect, it } from "vitest";
import { normalizeDocsPath, validateDocsPath } from "./config";

describe("validateDocsPath", () => {
  it("accepts a simple relative path", () => {
    expect(validateDocsPath("docs")).toBeUndefined();
    expect(validateDocsPath("wiki")).toBeUndefined();
    expect(validateDocsPath("docs/sub")).toBeUndefined();
  });

  it("rejects empty input", () => {
    expect(validateDocsPath("")).toMatch(/empty/i);
    expect(validateDocsPath("   ")).toMatch(/empty/i);
  });

  it("rejects absolute paths", () => {
    expect(validateDocsPath("/docs")).toMatch(/relative/i);
    expect(validateDocsPath("/Users/x/docs")).toMatch(/relative/i);
  });

  it("rejects parent traversal", () => {
    expect(validateDocsPath("../docs")).toMatch(/escape|\.\./i);
    expect(validateDocsPath("docs/../../etc")).toMatch(/escape|\.\./i);
  });

  it("accepts a trailing slash (normalized later)", () => {
    expect(validateDocsPath("docs/")).toBeUndefined();
  });
});

describe("normalizeDocsPath", () => {
  it("trims whitespace", () => {
    expect(normalizeDocsPath("  docs  ")).toBe("docs");
  });

  it("strips trailing slashes", () => {
    expect(normalizeDocsPath("docs/")).toBe("docs");
    expect(normalizeDocsPath("docs///")).toBe("docs");
  });

  it("defaults to docs when empty", () => {
    expect(normalizeDocsPath("")).toBe("docs");
    expect(normalizeDocsPath("   ")).toBe("docs");
  });

  it("keeps nested paths", () => {
    expect(normalizeDocsPath("docs/sub/")).toBe("docs/sub");
  });
});
