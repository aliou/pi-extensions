import { describe, expect, it } from "vitest";
import { encodePathSegments } from "./path";

describe("path utilities", () => {
  describe("encodePathSegments", () => {
    it("encodes each segment without escaping separators", () => {
      expect(encodePathSegments("src/a file.ts")).toBe("src/a%20file.ts");
    });

    it("preserves empty segments", () => {
      expect(encodePathSegments("/docs//hello world.md")).toBe(
        "/docs//hello%20world.md",
      );
    });
  });
});
