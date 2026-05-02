import { describe, expect, it } from "vitest";
import { isBlank, isPresent, truncate } from "./string";

describe("string utilities", () => {
  describe("truncate", () => {
    it("should truncate long strings", () => {
      const result = truncate("This is a very long string", 10);
      expect(result).toBe("This is a ...");
    });

    it("should return original string if within limit", () => {
      const result = truncate("Short", 10);
      expect(result).toBe("Short");
    });

    it("should handle exact length", () => {
      const result = truncate("Exactly10!", 10);
      expect(result).toBe("Exactly10!");
    });

    it("should handle empty string", () => {
      const result = truncate("", 10);
      expect(result).toBe("");
    });

    it("should handle zero max length", () => {
      const result = truncate("Test", 0);
      expect(result).toBe("...");
    });

    it("should handle very short max length", () => {
      const result = truncate("Test", 2);
      expect(result).toBe("Te...");
    });

    it("should handle negative max length", () => {
      const result = truncate("Test", -5);
      expect(result).toBe("...");
    });
  });

  describe("isBlank", () => {
    it("should return true for empty strings", () => {
      expect(isBlank("")).toBe(true);
      expect(isBlank("   ")).toBe(true);
      expect(isBlank("\t\n\r")).toBe(true);
    });

    it("should return true for null and undefined", () => {
      expect(isBlank(null)).toBe(true);
      expect(isBlank(undefined)).toBe(true);
    });

    it("should return false for non-empty strings", () => {
      expect(isBlank("hello")).toBe(false);
      expect(isBlank("0")).toBe(false);
      expect(isBlank("false")).toBe(false);
      expect(isBlank(" hello ")).toBe(false);
    });

    it("should handle numbers", () => {
      expect(isBlank(0)).toBe(false);
      expect(isBlank(1)).toBe(false);
      expect(isBlank(-1)).toBe(false);
      expect(isBlank(Number.NaN)).toBe(false);
    });

    it("should handle mixed whitespace", () => {
      expect(isBlank("  \t  \n  ")).toBe(true);
      expect(isBlank("  hello  ")).toBe(false);
    });
  });

  describe("isPresent", () => {
    it("should return true for non-empty strings", () => {
      expect(isPresent("hello")).toBe(true);
      expect(isPresent("0")).toBe(true);
      expect(isPresent("false")).toBe(true);
      expect(isPresent(" hello ")).toBe(true);
    });

    it("should return false for empty strings", () => {
      expect(isPresent("")).toBe(false);
      expect(isPresent("   ")).toBe(false);
      expect(isPresent("\t\n\r")).toBe(false);
    });

    it("should return false for null and undefined", () => {
      expect(isPresent(null)).toBe(false);
      expect(isPresent(undefined)).toBe(false);
    });

    it("should handle mixed whitespace", () => {
      expect(isPresent("  \t  \n  ")).toBe(false);
      expect(isPresent("  hello  ")).toBe(true);
    });

    it("should return true for strings with only non-whitespace", () => {
      expect(isPresent("a")).toBe(true);
      expect(isPresent("1")).toBe(true);
      expect(isPresent("!")).toBe(true);
    });
  });

  describe("type guards", () => {
    it("should properly narrow types for isBlank", () => {
      const value: string | null | undefined = "";

      if (isBlank(value)) {
        expect(value === "" || value === null || value === undefined).toBe(
          true,
        );
      }
    });

    it("should properly narrow types for isPresent", () => {
      const value: string | null | undefined = "hello";

      if (isPresent(value)) {
        expect(value.length).toBeGreaterThan(0);
      }
    });
  });
});
