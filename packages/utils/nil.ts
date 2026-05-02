export const isNil = <T>(
  arg: T | null | undefined,
): arg is null | undefined => {
  return arg === null || arg === undefined;
};

export const isNotNil = <T>(arg: T | null | undefined): arg is T => {
  return arg !== null && arg !== undefined;
};
