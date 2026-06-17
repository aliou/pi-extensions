import { describe, expect, it } from "vitest";
import { extractSessionToken, isInsideCodeSpan } from "./tokens";

describe("isInsideCodeSpan", () => {
  it("is false when there are no backticks", () => {
    expect(isInsideCodeSpan("hello world", 5)).toBe(false);
  });

  it("is true between an opening backtick and its closer", () => {
    expect(isInsideCodeSpan("`some @@ref`", 7)).toBe(true);
  });

  it("is false after a balanced pair of backticks", () => {
    expect(isInsideCodeSpan("`some @@ref` rest", 18)).toBe(false);
  });

  it("is true inside an unclosed code span", () => {
    expect(isInsideCodeSpan("`unclosed text", 10)).toBe(true);
  });
});

describe("extractSessionToken", () => {
  it("matches a bare @@ at the start of a line", () => {
    expect(extractSessionToken("@@")).toEqual({
      token: "",
      global: false,
      prefix: "@@",
    });
  });

  it("matches @@<token> at the start of a line", () => {
    expect(extractSessionToken("@@abc")).toEqual({
      token: "abc",
      global: false,
      prefix: "@@",
    });
  });

  it("matches @@<token> after whitespace", () => {
    expect(extractSessionToken("foo @@abc")?.token).toBe("abc");
  });

  it("matches @@@<token> as global", () => {
    expect(extractSessionToken("@@@abc")).toEqual({
      token: "abc",
      global: true,
      prefix: "@@@",
    });
  });

  it("does not match @@ in the middle of a word (email address)", () => {
    expect(extractSessionToken("user@@host")).toBeUndefined();
  });

  // Regression: after accepting an @@<uuid> completion and continuing to type
  // on the same line, the rest of the line must not be treated as a session
  // token. Otherwise Tab / force file completion is blocked on that line.
  it("does not span a complete @@<uuid> marker followed by more text", () => {
    expect(
      extractSessionToken("@@12345678-1234-1234-1234-1234567890ab /cmd"),
    ).toBeUndefined();
    expect(
      extractSessionToken("@@12345678-1234-1234-1234-1234567890ab sometext"),
    ).toBeUndefined();
  });

  it("still matches the @@<uuid> marker while the cursor is inside it", () => {
    expect(
      extractSessionToken("@@12345678-1234-1234-1234-1234567890ab")?.token,
    ).toBe("12345678-1234-1234-1234-1234567890ab");
  });

  // Regression: @@ written inside backticks must not trigger session
  // completion on the rest of the line.
  it("ignores @@ inside backticks (closed span, rest of line)", () => {
    expect(extractSessionToken("`@@foo` bar")).toBeUndefined();
    expect(extractSessionToken("`@@abc def`")).toBeUndefined();
    expect(extractSessionToken("text `@@foo` rest")).toBeUndefined();
  });

  it("ignores @@ inside an unclosed backtick code span", () => {
    expect(extractSessionToken("`some @@ref")).toBeUndefined();
  });

  it("does not treat the trailing @ of a file attachment as a session token", () => {
    // `@@<uuid> @` — cursor right after the file-attachment @
    expect(extractSessionToken("@@12345678-1234 @")).toBeUndefined();
  });
});
