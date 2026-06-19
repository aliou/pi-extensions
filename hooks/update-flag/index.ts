import type {
  ExecResult,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { BorderedLoader } from "@earendil-works/pi-coding-agent";
import { UpdateResultPanel, type UpdateStatus } from "./result-panel";

/**
 * Registers the `--update` CLI flag.
 *
 * When pi is started with `--update`, it runs `pi update --all` on startup and
 * then quits. On success it quits after a brief delay; on error or abort it
 * shows the result panel and waits for a keypress before quitting. While the
 * update runs, the editor is replaced with a bordered loader, then a compact
 * result panel.
 *
 * Useful for wrapping pi in an "update then exit" one-shot flow (e.g. a
 * launcher or cron).
 *
 * Only fires on a fresh process start (`session_start` reason `"startup"`),
 * so it never triggers on `/resume`, `/new`, or `/fork`.
 */
export default function updateFlag(pi: ExtensionAPI): void {
  pi.registerFlag("update", {
    description:
      "Run `pi update --all` on startup, then quit. One-shot update flow.",
    type: "boolean",
    default: false,
  });

  pi.on("session_start", (event, ctx) => {
    if (event.reason !== "startup") return;

    const update = pi.getFlag("update") as boolean | undefined;
    if (!update) return;

    // Non-interactive (print/JSON mode): no TUI. Just run the update and quit.
    if (!ctx.hasUI) {
      void runHeadless(pi, ctx);
      return;
    }

    // Interactive: replace the editor with loader -> result panel.
    void runInteractive(pi, ctx);
  });
}

const QUIT_DELAY_MS = 1500;

/** Interactive flow: bordered loader while running, then result panel, then quit. */
async function runInteractive(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
    const loader = new BorderedLoader(
      tui,
      theme,
      "Updating pi and extensions...",
    );
    // On abort, let the signal cancel the exec; the rejection flows through
    // showResult as an "aborted" status that waits for a keypress (no instant
    // quit).
    loader.onAbort = () => {
      /* handled via signal abort -> showResult */
    };

    let panel: UpdateResultPanel | null = null;

    function showResult(result: ExecResult, errorMessage?: string): void {
      const aborted = loader.signal.aborted;
      const ok =
        errorMessage === undefined &&
        result.code === 0 &&
        !result.killed &&
        !aborted;
      const status: UpdateStatus = ok
        ? "success"
        : aborted
          ? "aborted"
          : "error";
      const output = errorMessage
        ? aborted
          ? "Update was aborted."
          : `Failed to run pi update:\n${String(errorMessage)}`
        : [result.stdout ?? "", result.stderr ?? ""]
            .map((s) => s.trim())
            .filter(Boolean)
            .join("\n\n");
      panel = new UpdateResultPanel(theme, status, result.code, output, () =>
        done(),
      );
      tui.requestRender();
      // Success: auto-quit after a brief delay so the result is readable.
      // Error/abort: wait for a keypress, then quit (panel's onClose).
      if (ok) setTimeout(() => done(), QUIT_DELAY_MS);
    }

    void pi
      .exec("pi", ["update", "--all"], { signal: loader.signal })
      .then((result) => showResult(result))
      .catch((err) => showResult(zeroResult(), err));

    return {
      handleInput: (data: string) => {
        if (panel) panel.handleInput(data);
        else loader.handleInput(data);
      },
      render: (width: number) =>
        panel ? panel.render(width) : loader.render(width),
      invalidate: () => {
        panel?.invalidate();
        loader.invalidate();
      },
      dispose: () => loader.dispose(),
    };
  });

  // Component closed (auto or user): quit pi.
  ctx.shutdown();
}

/** Headless flow: no UI, just run the update and quit. */
async function runHeadless(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  try {
    const result = await pi.exec("pi", ["update", "--extensions"], {
      signal: ctx.signal,
    });
    if (result.code !== 0) {
      const detail = (result.stderr ?? result.stdout ?? "").trim();
      process.stderr.write(
        `pi update --all failed (exit ${result.code})\n${detail}\n`,
      );
    }
  } catch (err) {
    process.stderr.write(`pi update --all failed: ${String(err)}\n`);
  }
  ctx.shutdown();
}

function zeroResult(): ExecResult {
  return { stdout: "", stderr: "", code: 1, killed: false };
}
