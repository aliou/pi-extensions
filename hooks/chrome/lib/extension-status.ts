/**
 * Extension status line, mirroring pi's built-in footer.
 *
 * Extensions publish short status texts via `ctx.ui.setStatus(key, text)`.
 * The built-in footer renders them as one extra line below the stats line;
 * a custom footer has to do the same or those statuses are never shown.
 */

/**
 * Sanitize text for display in a single-line status.
 * Removes newlines, tabs, and carriage returns, then collapses runs of spaces.
 */
export function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

/**
 * Build the extension status line: entries sorted by key, values sanitized
 * and joined by a single space. Returns undefined when there is nothing to
 * show, so callers can keep the footer at its usual height.
 *
 * Status texts are returned uncolored: extensions supply their own colors.
 */
export function buildStatusLine(
  statuses: ReadonlyMap<string, string> | undefined,
): string | undefined {
  if (!statuses || statuses.size === 0) return undefined;

  const line = Array.from(statuses.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, text]) => sanitizeStatusText(text))
    .filter(Boolean)
    .join(" ");

  return line.length > 0 ? line : undefined;
}
