export function getHeader(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  return key ? headers[key] : undefined;
}

export function parsePercent(
  value: string | undefined,
  fractional: boolean,
): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const percent = fractional && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, percent));
}
