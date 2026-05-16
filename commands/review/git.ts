import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { err, isErr, ok, type Result } from "@harness/utils";
import { readDefaultBranch } from "./git-paths";

const DIFF_PREFIX_ARGS = [
  "-c",
  "diff.noprefix=false",
  "-c",
  "diff.mnemonicPrefix=false",
  "-c",
  "diff.srcPrefix=a/",
  "-c",
  "diff.dstPrefix=b/",
];

export interface PreparedDiff {
  diffFile: string;
  originalContent: string;
  tempDir: string;
}

export function resolveRange(args: string, cwd: string): Result<string, Error> {
  const trimmed = args.trim();

  if (!trimmed) return ok(readDefaultBranch(cwd) ?? "main");
  if (trimmed === "--current") return ok("HEAD^..HEAD");
  if (trimmed === "--staged" || trimmed === "--cached") return ok("--staged");
  if (trimmed === "--unstaged") return ok("--unstaged");

  return ok(trimmed);
}

export async function prepareDiffFile(
  pi: ExtensionAPI,
  cwd: string,
  range: string,
): Promise<Result<PreparedDiff, Error>> {
  const diffResult = await generateDiff(
    pi,
    cwd,
    range,
    shouldIncludeUntracked(range),
  );
  if (isErr(diffResult)) return diffResult;

  const tmpDir = mkdtempSync(join(tmpdir(), "pi-review-"));
  const safeName = range.replace(/[^a-zA-Z0-9._-]/g, "_");
  const diffFile = join(tmpDir, `review_${safeName}.diff`);

  writeFileSync(diffFile, diffResult.value, "utf-8");

  return ok({ diffFile, originalContent: diffResult.value, tempDir: tmpDir });
}

async function generateDiff(
  pi: ExtensionAPI,
  cwd: string,
  range: string,
  includeUntracked: boolean,
): Promise<Result<string, Error>> {
  const diffArgs = getDiffArgs(range);
  const result = await pi.exec("git", [...DIFF_PREFIX_ARGS, ...diffArgs], {
    cwd,
    timeout: 30,
  });

  if (result.code !== 0) {
    return err(
      new Error(`git diff failed (exit ${result.code}): ${result.stderr}`),
    );
  }

  const parts = [result.stdout.trim()].filter(Boolean);

  if (includeUntracked) {
    const untracked = await generateUntrackedDiffs(pi, cwd);
    if (isErr(untracked)) return untracked;
    if (untracked.value) parts.push(untracked.value);
  }

  const diff = parts.join("\n");
  if (!diff) return err(new Error("No diff produced. Is the range correct?"));

  return ok(diff);
}

function getDiffArgs(range: string): string[] {
  if (range === "--staged" || range === "--cached") return ["diff", "--cached"];
  if (range === "--unstaged") return ["diff"];
  return ["diff", range];
}

function shouldIncludeUntracked(range: string): boolean {
  return range !== "--staged" && range !== "--cached";
}

async function generateUntrackedDiffs(
  pi: ExtensionAPI,
  cwd: string,
): Promise<Result<string, Error>> {
  const files = await pi.exec(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    { cwd, timeout: 30 },
  );

  if (files.code !== 0) {
    return err(
      new Error(`git ls-files failed (exit ${files.code}): ${files.stderr}`),
    );
  }

  const diffs: string[] = [];
  for (const file of files.stdout.split("\n").filter(Boolean)) {
    const result = await pi.exec(
      "git",
      [...DIFF_PREFIX_ARGS, "diff", "--no-index", "--", "/dev/null", file],
      { cwd, timeout: 30 },
    );

    if (result.code !== 0 && result.code !== 1) {
      return err(
        new Error(
          `git diff --no-index failed (exit ${result.code}): ${result.stderr}`,
        ),
      );
    }

    const diff = result.stdout.trim();
    if (diff) diffs.push(normalizeNoIndexDiff(diff, file));
  }

  return ok(diffs.join("\n"));
}

function normalizeNoIndexDiff(diff: string, file: string): string {
  return diff
    .replace(
      /^diff --git a\/dev\/null b\/(.+)$/m,
      `diff --git a/${file} b/${file}`,
    )
    .replace(/^--- a\/dev\/null$/m, "--- /dev/null");
}
