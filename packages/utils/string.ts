import { isNil } from "./nil";

export const truncate = (
  input: string,
  maxLength: number,
  ellipsis = "...",
): string => {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength)}${ellipsis}`;
};

const isString = (value: unknown): value is string => {
  return typeof value === "string";
};

export const isBlank = (
  value: string | undefined | null | number,
): value is "" | null | undefined =>
  isString(value) ? value.trim() === "" : isNil(value);

type NonEmptyString<T extends string> = T extends "" ? never : T;
export const isPresent = (
  value: string | undefined | null,
): value is NonEmptyString<string> => !isBlank(value);
