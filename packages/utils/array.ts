import { isNil } from "./nil";

/**
 * Split an array into chunks of a given size.
 * Vendored from radash (MIT license).
 */
const cluster = <T>(list: readonly T[], size = 2): T[][] => {
  const clusterCount = Math.ceil(list.length / size);
  return new Array(clusterCount)
    .fill(null)
    .map((_c: null, i: number) => list.slice(i * size, i * size + size));
};

export const findFirst = <T>(
  array: T[],
  predicate: (value: T) => boolean,
): T | undefined => {
  for (const value of array) {
    if (predicate(value)) {
      return value;
    }
  }

  return;
};

export const get = <T extends object & { value: unknown }>(
  array: T[],
  check: T["value"],
  key: keyof T,
) => {
  for (const item of array) {
    if (item.value === check) {
      return item[key];
    }
  }

  return;
};

export const isEmptyArray = <T>(arg: T[] | null | undefined): arg is [] => {
  return arg === null || arg === undefined || arg.length === 0;
};

export const isNotEmptyArray = <T>(
  arg: T[] | null | undefined,
): arg is [T, ...T[]] => {
  return arg !== null && arg !== undefined && arg.length > 0;
};

export const isSoleArray = <T>(arg: T[] | null | undefined): arg is [T] => {
  return arg !== null && arg !== undefined && arg.length === 1;
};

export const partition = <T>(
  array: T[],
  fn: (item: T) => boolean,
): [T[], T[]] => {
  const { truthy, falsy } = array.reduce(
    (acc, item) => {
      const key = fn(item) ? "truthy" : "falsy";
      acc[key].push(item);
      return acc;
    },
    { truthy: [] as T[], falsy: [] as T[] },
  );

  return [truthy ?? [], falsy ?? []];
};

export const wrap = <T>(value: T | T[] | undefined): T[] =>
  isNil(value) ? [] : Array.isArray(value) ? value : [value];

export const pluck = <T extends object, K extends keyof T>(
  array: T[],
  key: K,
): T[K][] => array.map((item) => item[key]);

export const chunksOf = <T>(array: T[], size: number): T[][] =>
  cluster(array, size);
