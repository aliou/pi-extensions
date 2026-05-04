import { describe, expect, it } from "vitest";
import {
  chunksOf,
  findFirst,
  get,
  isEmptyArray,
  isNotEmptyArray,
  partition,
  pluck,
  wrap,
} from "./array";

describe("array utilities", () => {
  describe("findFirst", () => {
    it("should return the first element that matches the predicate", () => {
      const numbers = [1, 2, 3, 4, 5];
      const result = findFirst(numbers, (n) => n > 3);
      expect(result).toBe(4);
    });

    it("should return undefined if no element matches", () => {
      const numbers = [1, 2, 3];
      const result = findFirst(numbers, (n) => n > 5);
      expect(result).toBeUndefined();
    });

    it("should work with empty array", () => {
      const result = findFirst([], (n) => n > 0);
      expect(result).toBeUndefined();
    });
  });

  describe("get", () => {
    it("should return the value for matching key", () => {
      const items = [
        { value: "a", label: "Apple" },
        { value: "b", label: "Banana" },
      ];
      const result = get(items, "a", "label");
      expect(result).toBe("Apple");
    });

    it("should return undefined for non-matching value", () => {
      const items = [
        { value: "a", label: "Apple" },
        { value: "b", label: "Banana" },
      ];
      const result = get(items, "c", "label");
      expect(result).toBeUndefined();
    });

    it("should work with empty array", () => {
      // @ts-expect-error
      const result = get([], "a", "label");
      expect(result).toBeUndefined();
    });
  });

  describe("isEmptyArray", () => {
    it("should return true for null", () => {
      expect(isEmptyArray(null)).toBe(true);
    });

    it("should return true for undefined", () => {
      expect(isEmptyArray(undefined)).toBe(true);
    });

    it("should return true for empty array", () => {
      expect(isEmptyArray([])).toBe(true);
    });

    it("should return false for non-empty array", () => {
      expect(isEmptyArray([1, 2, 3])).toBe(false);
    });
  });

  describe("isNotEmptyArray", () => {
    it("should return false for null", () => {
      expect(isNotEmptyArray(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isNotEmptyArray(undefined)).toBe(false);
    });

    it("should return false for empty array", () => {
      expect(isNotEmptyArray([])).toBe(false);
    });

    it("should return true for non-empty array", () => {
      expect(isNotEmptyArray([1, 2, 3])).toBe(true);
    });
  });

  describe("partition", () => {
    it("should partition array based on predicate", () => {
      const numbers = [1, 2, 3, 4, 5, 6];
      const [even, odd] = partition(numbers, (n) => n % 2 === 0);
      expect(even).toEqual([2, 4, 6]);
      expect(odd).toEqual([1, 3, 5]);
    });

    it("should handle empty array", () => {
      const [truthy, falsy] = partition([], (n) => n > 0);
      expect(truthy).toEqual([]);
      expect(falsy).toEqual([]);
    });

    it("should handle all truthy", () => {
      const [truthy, falsy] = partition([1, 2, 3], (n) => n > 0);
      expect(truthy).toEqual([1, 2, 3]);
      expect(falsy).toEqual([]);
    });

    it("should handle all falsy", () => {
      const [truthy, falsy] = partition([1, 2, 3], (n) => n > 10);
      expect(truthy).toEqual([]);
      expect(falsy).toEqual([1, 2, 3]);
    });
  });

  describe("wrap", () => {
    it("should wrap single value in array", () => {
      expect(wrap(5)).toEqual([5]);
      expect(wrap("hello")).toEqual(["hello"]);
    });

    it("should return existing array as-is", () => {
      const arr = [1, 2, 3];
      expect(wrap(arr)).toBe(arr);
    });

    it("should return empty array for undefined", () => {
      expect(wrap(undefined)).toEqual([]);
    });

    it("should return empty array for null", () => {
      expect(wrap(null)).toEqual([]);
    });
  });

  describe("pluck", () => {
    it("should extract values by key", () => {
      const objects = [
        { name: "Alice", age: 25 },
        { name: "Bob", age: 30 },
        { name: "Charlie", age: 35 },
      ];
      expect(pluck(objects, "name")).toEqual(["Alice", "Bob", "Charlie"]);
      expect(pluck(objects, "age")).toEqual([25, 30, 35]);
    });

    it("should work with empty array", () => {
      expect(pluck([], "name")).toEqual([]);
    });
  });

  describe("chunksOf", () => {
    it("should split array into chunks of specified size", () => {
      const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const chunks = chunksOf(numbers, 3);
      expect(chunks).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);
    });

    it("should handle incomplete last chunk", () => {
      const numbers = [1, 2, 3, 4, 5];
      const chunks = chunksOf(numbers, 2);
      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("should handle empty array", () => {
      expect(chunksOf([], 3)).toEqual([]);
    });

    it("should handle single element", () => {
      expect(chunksOf([1], 3)).toEqual([[1]]);
    });
  });
});
