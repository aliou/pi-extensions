import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { encodePathSegments, expandHomePath } from "./path";

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

  describe("expandHomePath", () => {
    it("expands home paths", () => {
      expect(expandHomePath("~")).toBe(homedir());
      expect(expandHomePath("~/notes")).toBe(join(homedir(), "notes"));
    });

    it("leaves non-home paths unchanged", () => {
      expect(expandHomePath("src/file.ts")).toBe("src/file.ts");
      expect(expandHomePath("/tmp/file.ts")).toBe("/tmp/file.ts");
      expect(expandHomePath("~aliou/file.ts")).toBe("~aliou/file.ts");
    });
  });
});
