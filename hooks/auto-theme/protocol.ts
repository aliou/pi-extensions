/**
 * Mode 2031 terminal protocol helpers.
 *
 * Mode 2031 is a terminal extension for colorscheme change notifications.
 *   Enable notifications:  CSI ? 2031 h
 *   Disable notifications: CSI ? 2031 l
 *   Query current state:   CSI ? 996 n
 *   Terminal responds:      CSI ? 997 ; Ps n  (Ps=1 dark, Ps=2 light)
 *
 * See: https://contour-terminal.org/vt-extensions/color-palette-update-notifications/
 */

import { THEME_DARK, THEME_LIGHT } from "./constants";

// ----- Terminal sequences -----

/** Enable Mode 2031 colorscheme change notifications. */
export const ENABLE_MODE_2031 = "\x1b[?2031h";

/** Disable Mode 2031 colorscheme change notifications. */
export const DISABLE_MODE_2031 = "\x1b[?2031l";

/** Query the current colorscheme (triggers a CSI ? 997 ; Ps n response). */
export const QUERY_COLORSCHEME = "\x1b[?996n";

// CSI ? 997 ; Ps n — Ps is 1 (dark) or 2 (light)
// biome-ignore lint/suspicious/noControlCharactersInRegex: This is the CSI mode, it needs to be like this
const MODE_2031_RE = /\x1b\[\?997;(\d)n/;

/**
 * Creates a Mode 2031 stdin parser.
 *
 * Returns a function that accepts a Buffer and returns THEME_DARK or
 * THEME_LIGHT if a colorscheme response was found, or null otherwise.
 *
 * The parser maintains its own internal buffer to handle responses that
 * arrive split across multiple stdin data events. The buffer is scoped
 * to the returned closure, so it doesn't leak across sessions or reloads.
 */
export function createMode2031Parser(): (chunk: Buffer) => string | null {
  let buf = "";

  return (chunk: Buffer): string | null => {
    buf += chunk.toString("latin1"); // preserve raw escape bytes

    let result: string | null = null;
    let match: RegExpExecArray | null;

    match = MODE_2031_RE.exec(buf);
    while (match !== null) {
      const psRaw = match[1];
      if (psRaw != null) {
        const ps = Number(psRaw);
        if (ps === 1 || ps === 2) {
          result = ps === 2 ? THEME_LIGHT : THEME_DARK;
        }
      }

      // Remove matched portion and reset search
      buf =
        buf.slice(0, match.index) + buf.slice(match.index + match[0].length);
      match = MODE_2031_RE.exec(buf);
    }

    // Keep buffer bounded — discard stale data that doesn't match our pattern.
    // Truncation can split a partial sequence, but that's fine: an incomplete
    // CSI response won't match the regex, so the next full response will parse
    // correctly when it arrives.
    if (buf.length > 256) {
      buf = buf.slice(-64);
    }

    return result;
  };
}
