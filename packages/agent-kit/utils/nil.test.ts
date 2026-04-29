import { describe, expect, it } from "vitest";
import { isNil, isNotNil } from "./nil";

describe("nil utilities", () => {
  describe("isNil", () => {
    it("should return true for null", () => {
      expect(isNil(null)).toBe(true);
    });

    it("should return true for undefined", () => {
      expect(isNil(undefined)).toBe(true);
    });

    it("should return false for falsy values that are not null/undefined", () => {
      expect(isNil(false)).toBe(false);
      expect(isNil(0)).toBe(false);
      expect(isNil("")).toBe(false);
      expect(isNil(Number.NaN)).toBe(false);
    });

    it("should return false for truthy values", () => {
      expect(isNil(true)).toBe(false);
      expect(isNil(1)).toBe(false);
      expect(isNil("hello")).toBe(false);
      expect(isNil([])).toBe(false);
      expect(isNil({})).toBe(false);
    });

    it("should work with objects", () => {
      expect(isNil({ key: "value" })).toBe(false);
    });

    it("should work with arrays", () => {
      expect(isNil([1, 2, 3])).toBe(false);
      expect(isNil([])).toBe(false);
    });
  });

  describe("isNotNil", () => {
    it("should return false for null", () => {
      expect(isNotNil(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isNotNil(undefined)).toBe(false);
    });

    it("should return true for falsy values that are not null/undefined", () => {
      expect(isNotNil(false)).toBe(true);
      expect(isNotNil(0)).toBe(true);
      expect(isNotNil("")).toBe(true);
      expect(isNotNil(Number.NaN)).toBe(true);
    });

    it("should return true for truthy values", () => {
      expect(isNotNil(true)).toBe(true);
      expect(isNotNil(1)).toBe(true);
      expect(isNotNil("hello")).toBe(true);
      expect(isNotNil([])).toBe(true);
      expect(isNotNil({})).toBe(true);
    });

    it("should work with objects", () => {
      expect(isNotNil({ key: "value" })).toBe(true);
    });

    it("should work with arrays", () => {
      expect(isNotNil([1, 2, 3])).toBe(true);
      expect(isNotNil([])).toBe(true);
    });
  });

  describe("type guards", () => {
    it("should properly narrow types for isNil", () => {
      const value: string | null | undefined = "hello";

      if (isNil(value)) {
        // TypeScript should know value is null | undefined here
        expect(value).toBeNull();
      } else {
        // TypeScript should know value is string here
        expect(typeof value).toBe("string");
      }
    });

    it("should properly narrow types for isNotNil", () => {
      const value: string | null | undefined = "hello";

      if (isNotNil(value)) {
        // TypeScript should know value is string here
        expect(typeof value).toBe("string");
      } else {
        // TypeScript should know value is null | undefined here
        expect(value).toBeNull();
      }
    });
  });
});
