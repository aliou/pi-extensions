/**
 * Auto-Theme Hook
 *
 * Automatically switches Pi's theme when the terminal colorscheme changes
 * between dark and light mode, using Mode 2031 (terminal-native colorscheme
 * notifications).
 *
 * Mode 2031 protocol:
 *   Enable notifications:  CSI ? 2031 h
 *   Disable notifications: CSI ? 2031 l
 *   Query current state:   CSI ? 996 n
 *   Terminal responds:      CSI ? 997 ; Ps n  (Ps=1 dark, Ps=2 light)
 *
 * Supported by: Ghostty, iTerm2 3.6.6+, kitty 0.38.1+, Contour, VTE 0.82+,
 * and tmux 3.6+ (proxies to outer terminal).
 *
 * Unsupported terminals silently ignore the sequences, so this hook is a
 * no-op when the terminal doesn't respond.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { QUERY_TIMEOUT_MS } from "./constants";
import {
  createMode2031Parser,
  DISABLE_MODE_2031,
  ENABLE_MODE_2031,
  QUERY_COLORSCHEME,
} from "./protocol";

export default function (pi: ExtensionAPI) {
  let currentTheme: string | null = null;
  let mode2031Active = false;
  let queryTimeout: ReturnType<typeof setTimeout> | null = null;
  let cleanupFns: (() => void)[] = [];

  function writeSeq(seq: string): void {
    if (process.stdout.isTTY) {
      process.stdout.write(seq);
    }
  }

  function attachStdin(onTheme: (theme: string) => void): boolean {
    try {
      if (!process.stdin.isTTY) return false;
      const parse = createMode2031Parser();
      const listener = (chunk: Buffer) => {
        const theme = parse(chunk);
        if (theme !== null) {
          mode2031Active = true;

          if (queryTimeout) {
            clearTimeout(queryTimeout);
            queryTimeout = null;
          }

          onTheme(theme);
        }
      };
      process.stdin.on("data", listener);
      cleanupFns.push(() => {
        process.stdin.removeListener("data", listener);
      });
      return true;
    } catch {
      return false;
    }
  }

  function cleanup(): void {
    writeSeq(DISABLE_MODE_2031);
    for (const fn of cleanupFns) fn();
    cleanupFns = [];
    if (queryTimeout) {
      clearTimeout(queryTimeout);
      queryTimeout = null;
    }
    currentTheme = null;
    mode2031Active = false;
  }

  pi.on("session_start", async (_event, ctx) => {
    const onTheme = (theme: string) => {
      if (theme !== currentTheme) {
        currentTheme = theme;
        ctx.ui.setTheme(theme);
      }
    };

    if (!attachStdin(onTheme)) return;

    writeSeq(ENABLE_MODE_2031);
    writeSeq(QUERY_COLORSCHEME);

    queryTimeout = setTimeout(() => {
      if (!mode2031Active) {
        // Terminal doesn't support Mode 2031. Tear down stdin listener.
        for (const fn of cleanupFns) fn();
        cleanupFns = [];
        writeSeq(DISABLE_MODE_2031);
      }
      queryTimeout = null;
    }, QUERY_TIMEOUT_MS);
  });

  pi.on("session_shutdown", () => {
    cleanup();
  });
}
