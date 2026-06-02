import { spawn, spawnSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { getEditor } from "@harness/ui";
import { err, ok, type Result } from "@harness/utils";

export type SplitEnvironment = "tmux" | "ghostty" | "unknown";

export function detectSplitEnvironment(): SplitEnvironment {
  if (process.env.TMUX) return "tmux";
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

    const interval = setInterval(() => {
      if (existsSync(doneFile)) {
        clearInterval(interval);
        removeFile(doneFile);
        resolve(0);
      }
    }, 500);
  });
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function appleScriptString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function removeFile(path: string) {
  try {
    unlinkSync(path);
  } catch (error) {
    void error;
  }
}
