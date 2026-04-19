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
