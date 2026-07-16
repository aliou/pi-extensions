// biome-ignore lint/plugin: pi.exec buffers stdout; grep must stream and bound ripgrep output.
import { spawn } from "node:child_process";
import type { RgMatch } from "./types";

const MAX_RG_OUTPUT_BYTES = 1024 * 1024;
const MAX_RG_ERROR_BYTES = 16 * 1024;

export interface RgSearchResult {
  matches: RgMatch[];
  matchCount: number;
  matchLimitReached: boolean;
  outputTruncated: boolean;
  stderr: string;
  code: number | null;
  killed: boolean;
}

export async function runRg(
  args: string[],
  cwd: string,
  signal: AbortSignal | undefined,
  matchLimit: number,
  spawnProcess: typeof spawn = spawn,
): Promise<RgSearchResult> {
  if (signal?.aborted) {
    throw new Error("Operation aborted");
  }

  return new Promise((resolve, reject) => {
    const process = spawnProcess("rg", args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const matches: RgMatch[] = [];
    let matchCount = 0;
    let matchLimitReached = false;
    let outputTruncated = false;
    let killed = false;
    let aborted = false;
    let stdoutBytes = 0;
    let pending = "";
    let stderr = "";
    let settled = false;

    const terminate = () => {
      if (!killed) {
        killed = true;
        process.kill("SIGTERM");
      }
    };

    const onAbort = () => {
      aborted = true;
      terminate();
    };

    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      if (aborted) {
        reject(new Error("Operation aborted"));
        return;
      }
      resolve({
        matches,
        matchCount,
        matchLimitReached,
        outputTruncated,
        stderr,
        code,
        killed,
      });
    };

    const parseLine = (line: string) => {
      if (killed || !line.trim()) return;

      let event: {
        type: string;
        data?: { path?: { text: string }; line_number?: number };
      };
      try {
        event = JSON.parse(line);
      } catch (_error) {
        void _error;
        return;
      }

      if (event.type !== "match") return;

      matchCount++;
      const filePath = event.data?.path?.text;
      const lineNumber = event.data?.line_number;
      if (filePath && typeof lineNumber === "number") {
        matches.push({ filePath, lineNumber });
      }

      if (matchCount >= matchLimit) {
        matchLimitReached = true;
        terminate();
      }
    };

    process.stdout?.on("data", (chunk: Buffer | string) => {
      if (killed) return;

      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const bytes = Buffer.byteLength(text, "utf8");
      if (stdoutBytes + bytes > MAX_RG_OUTPUT_BYTES) {
        outputTruncated = true;
        terminate();
        return;
      }
      stdoutBytes += bytes;
      pending += text;

      let newlineIndex = pending.indexOf("\n");
      while (newlineIndex !== -1 && !killed) {
        parseLine(pending.slice(0, newlineIndex).replace(/\r$/, ""));
        pending = pending.slice(newlineIndex + 1);
        newlineIndex = pending.indexOf("\n");
      }
    });

    process.stderr?.on("data", (chunk: Buffer | string) => {
      if (Buffer.byteLength(stderr, "utf8") >= MAX_RG_ERROR_BYTES) return;
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const remaining = MAX_RG_ERROR_BYTES - Buffer.byteLength(stderr, "utf8");
      stderr += text.slice(0, remaining);
    });

    process.once("error", (error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      reject(error);
    });
    process.once("close", (code) => {
      if (!killed && pending) parseLine(pending);
      finish(code);
    });

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
