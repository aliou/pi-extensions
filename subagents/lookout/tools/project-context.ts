/**
 * Project context generator for the lookout subagent.
 *
 * Uses `git ls-files` to get the list of tracked and untracked-but-not-ignored
 * files, then produces a compact summary: file extension counts and directory
 * tree. Injected into the system prompt so the model knows the repo layout
 * before it starts searching.
 *
 * Returns an empty string for non-git directories.
 */

import { spawn } from "node:child_process";
import { dirname, extname } from "node:path";

const MAX_TREE_DEPTH = 3;
const MAX_TREE_ENTRIES = 80;

/**
 * Get tracked + untracked (but not ignored) files via git.
 * Returns relative paths, or null if not a git repo.
 */
async function gitListFiles(cwd: string): Promise<string[] | null> {
  return new Promise((resolve) => {
    const child = spawn(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd, stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      resolve(
        stdout
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
      );
    });

    child.on("error", () => resolve(null));
  });
}

/**
 * Build a compact directory tree from a flat list of file paths.
 * Shows directories up to MAX_TREE_DEPTH and individual files at depth 0-1.
 */
function buildTree(files: string[]): string[] {
  const dirs = new Set<string>();
  const topFiles: string[] = [];

  for (const file of files) {
    let dir = dirname(file);
    while (dir !== ".") {
      if (dir.split("/").length <= MAX_TREE_DEPTH) {
        dirs.add(dir);
      }
      dir = dirname(dir);
    }

    if (file.split("/").length <= 2) {
      topFiles.push(file);
    }
  }

  const sortedDirs = [...dirs]
    .sort()
    .slice(0, MAX_TREE_ENTRIES)
    .map((d) => `${d}/`);
  const remaining = MAX_TREE_ENTRIES - sortedDirs.length;
  const sortedFiles = topFiles.sort().slice(0, remaining);

  return [...sortedDirs, ...sortedFiles];
}

/**
 * Generate a project context string for injection into the lookout system prompt.
 * Returns an empty string if the directory is not a git repository.
 */
export async function generateProjectContext(cwd: string): Promise<string> {
  const files = await gitListFiles(cwd);
  if (!files || files.length === 0) return "";

  const extCounts = new Map<string, number>();
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (ext) {
      extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);
    }
  }

  const tree = buildTree(files);

  const lines: string[] = ["## Project Context"];

  if (extCounts.size > 0) {
    const sorted = [...extCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    const parts = sorted.map(([ext, count]) => `${count} ${ext}`);
    lines.push(`Files: ${parts.join(", ")}`);
  }

  if (tree.length > 0) {
    lines.push("Structure:");
    for (const entry of tree) {
      lines.push(`  ${entry}`);
    }
    if (tree.length >= MAX_TREE_ENTRIES) {
      lines.push("  ... (truncated)");
    }
  }

  return lines.join("\n");
}
