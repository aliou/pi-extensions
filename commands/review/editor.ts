import { spawn, spawnSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { getEditor } from "@harness/ui";
import { err, ok, type Result } from "@harness/utils";

export type SplitEnvironment = "tmux" | "herdr" | "ghostty" | "unknown";

export function detectSplitEnvironment(): SplitEnvironment {
  if (process.env.TMUX) return "tmux";
  if (process.env.HERDR_ENV === "1" && process.env.HERDR_PANE_ID) {
    return "herdr";
  }
  if (process.env.TERM_PROGRAM === "ghostty") return "ghostty";
  return "unknown";
}

export async function openInSplit(
  diffFile: string,
  cwd: string,
): Promise<Result<number | null, Error>> {
  const editor = getEditor();
  const environment = detectSplitEnvironment();

  if (environment === "tmux") {
    const exitCode = await openInTmuxSplit(diffFile, cwd, editor);
    return ok(exitCode);
  }

  if (environment === "herdr") {
    const exitCode = await openInHerdrSplit(diffFile, cwd, editor);
    return ok(exitCode);
  }

  if (environment === "ghostty") {
    const exitCode = await openInGhosttySplit(diffFile, cwd, editor);
    return ok(exitCode);
  }

  return err(new Error("No split environment detected. Use /review instead"));
}

function openInTmuxSplit(
  diffFile: string,
  cwd: string,
  editor: string,
): Promise<number | null> {
  return new Promise((resolve) => {
    const signal = `pi-review-${Date.now()}`;
    const shellCommand = `${shellQuote(editor)} ${shellQuote(diffFile)}; tmux wait-for -S ${shellQuote(signal)}`;
    const child = spawn(
      "tmux",
      ["split-window", "-h", "-c", cwd, shellCommand],
      {
        detached: true,
        stdio: "ignore",
      },
    );

    child.unref();

    const wait = spawnSync("tmux", ["wait-for", signal]);

    resolve(wait.error ? 1 : 0);
  });
}

function openInHerdrSplit(
  diffFile: string,
  cwd: string,
  editor: string,
): Promise<number | null> {
  return new Promise((resolve) => {
    const herdr = process.env.HERDR_BIN_PATH || "herdr";
    const doneFile = `${diffFile}.done`;
    const split = spawnSync(
      herdr,
      [
        "pane",
        "split",
        "--current",
        "--direction",
        "right",
        "--cwd",
        cwd,
        "--focus",
      ],
      { encoding: "utf-8", timeout: 10_000 },
    );
    const paneId = parseHerdrPaneId(split.stdout);

    if (split.status !== 0 || split.error || !paneId) {
      resolve(1);
      return;
    }

    const command = `${shellQuote(editor)} ${shellQuote(diffFile)}; touch ${shellQuote(doneFile)}; exit`;
    const run = spawnSync(herdr, ["pane", "run", paneId, command], {
      encoding: "utf-8",
      timeout: 10_000,
    });

    if (run.status !== 0 || run.error) {
      spawnSync(herdr, ["pane", "close", paneId], { timeout: 10_000 });
      resolve(1);
      return;
    }

    waitForDoneFile(doneFile, resolve);
  });
}

function openInGhosttySplit(
  diffFile: string,
  cwd: string,
  editor: string,
): Promise<number | null> {
  return new Promise((resolve) => {
    const doneFile = `${diffFile}.done`;
    const script = `
tell application "Ghostty"
  set config to new surface configuration
  set initial working directory of config to ${appleScriptString(cwd)}
  set initial input of config to ${appleScriptString(`${shellQuote(editor)} ${shellQuote(diffFile)}; touch ${shellQuote(doneFile)}; exit\n`)}
  split (focused terminal of selected tab of front window) direction right with configuration config
end tell`;

    const result = spawnSync("osascript", ["-e", script], {
      encoding: "utf-8",
      timeout: 10_000,
    });

    if (result.status !== 0) {
      resolve(1);
      return;
    }

    waitForDoneFile(doneFile, resolve);
  });
}

export function parseHerdrPaneId(
  stdout: string | Buffer | null,
): string | null {
  if (!stdout) return null;

  try {
    const response = JSON.parse(stdout.toString()) as {
      result?: { pane?: { pane_id?: unknown } };
    };
    const paneId = response.result?.pane?.pane_id;
    return typeof paneId === "string" && paneId.length > 0 ? paneId : null;
  } catch {
    return null;
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function appleScriptString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function waitForDoneFile(
  doneFile: string,
  resolve: (exitCode: number | null) => void,
) {
  const interval = setInterval(() => {
    if (existsSync(doneFile)) {
      clearInterval(interval);
      removeFile(doneFile);
      resolve(0);
    }
  }, 500);
}

function removeFile(path: string) {
  try {
    unlinkSync(path);
  } catch (error) {
    void error;
  }
}
