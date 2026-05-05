/**
 * Formats minor currency units (cents) as a dollar string.
 */
export function formatCurrency(minorUnits: number, currency = "USD"): string {
  const major = minorUnits / 100;
  if (currency === "USD") {
    return `$${major.toFixed(2)}`;
  }
  return `${major.toFixed(2)} ${currency}`;
}

export type RelativeTimeInput = Date | string | number;

function toTimeMs(input: RelativeTimeInput): number {
  if (input instanceof Date) return input.getTime();
  if (typeof input === "number") return input;
  return new Date(input).getTime();
}

/**
 * Formats a date-like value as a compact relative time string.
 */
export function formatRelativeTime(input: RelativeTimeInput): string {
  const then = toTimeMs(input);
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Formats a remaining time duration from a Date.
 */
export function formatTimeRemaining(date: Date | null): string {
  if (!date) return "Unknown";

  const remainingMs = date.getTime() - Date.now();
  if (remainingMs <= 0) return "soon";

  const totalMinutes = Math.ceil(remainingMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}m`;
}

/**
 * Formats a Date as a localized time string.
 */
export function formatResetTime(date: Date | null): string {
  if (!date) return "Unknown";
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  if (isToday) {
    return date.toLocaleTimeString(undefined, timeFormat).toLowerCase();
  }
  return date
    .toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      ...timeFormat,
    })
    .toLowerCase();
}
