import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import {
  type NvimConnectionState,
  registerNvimContextHook,
} from "./nvim-context";

export type { NvimConnectionState } from "./nvim-context";

export function setupNvimHooks(pi: ExtensionAPI, state: NvimConnectionState) {
  registerNvimContextHook(pi, state);

  // Register custom message renderer for diagnostics
  pi.registerMessageRenderer("nvim-diagnostics", (message, options, theme) => {
    const { expanded } = options;
    const details = message.details as
      | {
          diagnostics?: Record<
            string,
            Array<{
              line: number;
              col: number;
              message: string;
              source?: string;
            }>
          >;
        }
      | undefined;

    if (!details?.diagnostics) {
      return new Text(theme.fg("error", "LSP errors detected"), 0, 0);
    }

    const errorCount = Object.values(details.diagnostics).reduce(
      (sum, errs) => sum + errs.length,
      0,
    );
    const fileCount = Object.keys(details.diagnostics).length;

    let text = theme.fg(
      "error",
      `LSP: ${errorCount} error${errorCount > 1 ? "s" : ""}`,
    );
    text += theme.fg("dim", ` in ${fileCount} file${fileCount > 1 ? "s" : ""}`);

    if (expanded) {
      for (const [file, errors] of Object.entries(details.diagnostics)) {
        const filename = file.split("/").pop() ?? file;
        text += `\n${theme.fg("accent", filename)}`;
        for (const err of errors) {
          const source = err.source ? theme.fg("dim", ` (${err.source})`) : "";
          text += `\n  ${theme.fg("dim", `L${err.line}:${err.col}`)} ${err.message}${source}`;
        }
      }
    }

    return new Text(text, 0, 0);
  });
}
