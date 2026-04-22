/**
 * Clone a GitHub repository to a temporary directory.
 *
 * Returns the local path so the scout can use repo_read to explore files.
 */

import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const execFileAsync = promisify(execFile);

interface CloneResult {
  cloneDir: string;
  repo: string;
  ref?: string;
}

/** Track cloned repos so repo_read can validate paths. */
const activeClones = new Map<string, string>(); // repo -> cloneDir

export function getCloneDir(repo: string): string | undefined {
  return activeClones.get(repo);
}

const parameters = Type.Object({
  repo: Type.String({
    description: "Repository in owner/repo format (e.g., 'openai/codex')",
  }),
  ref: Type.Optional(
    Type.String({
      description:
        "Branch, tag, or commit SHA to clone. Defaults to the default branch.",
    }),
  ),
  depth: Type.Optional(
    Type.Number({
      description:
        "Clone depth for shallow clone. Defaults to 1. Use 0 for full history.",
    }),
  ),
});

export const cloneRepoTool: ToolDefinition<typeof parameters> = {
  name: "clone_repo",
  label: "Clone Repo",
  description: `Clone a GitHub repository to a temporary directory for deep exploration.

Use when you need to read many files or grep/search through a codebase that the GitHub API cannot efficiently serve (e.g., large repos, complex cross-file searches).

After cloning, use repo_read to read files from the cloned directory.
The clone is ephemeral and will be cleaned up automatically.

Examples:
- clone_repo(repo="openai/codex")
- clone_repo(repo="facebook/react", ref="main", depth=0)`,

  parameters,

  async execute(
    _toolCallId: string,
    args: { repo: string; ref?: string; depth?: number },
    signal: AbortSignal | undefined,
  ) {
    const { repo, ref, depth } = args;
    const cloneDepth = depth ?? 1;

    // Validate repo format
    const parts = repo.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Invalid repository format: ${repo}. Expected 'owner/repo'.`,
          },
        ],
        details: { error: "invalid_repo_format" },
      };
    }

    // Check if already cloned
    const existing = activeClones.get(repo);
    if (existing) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Repository ${repo} already cloned at: ${existing}`,
          },
        ],
        details: { cloneDir: existing, repo, ref, reused: true },
      };
    }

    // Create temp directory
    const baseDir = join(tmpdir(), "pi-scout-clones");
    await mkdir(baseDir, { recursive: true });
    const cloneDir = join(baseDir, repo.replace("/", "--"));

    // Clean up if exists from a previous run
    try {
      await rm(cloneDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    // Build git clone args
    const gitUrl = `https://github.com/${repo}.git`;
    const cloneArgs = ["clone", "--single-branch"];
    if (cloneDepth > 0) {
      cloneArgs.push("--depth", String(cloneDepth));
    }
    if (ref) {
      cloneArgs.push("--branch", ref);
    }
    cloneArgs.push(gitUrl, cloneDir);

    try {
      const { stderr } = await execFileAsync("git", cloneArgs, {
        signal,
        timeout: 120_000,
      });

      // Track the clone
      activeClones.set(repo, cloneDir);

      return {
        content: [
          {
            type: "text" as const,
            text: `Cloned ${repo} to ${cloneDir}${ref ? ` (ref: ${ref})` : ""}${cloneDepth > 0 ? ` (depth: ${cloneDepth})` : " (full history)"}.${stderr ? `\n${stderr.trim()}` : ""}`,
          },
        ],
        details: { cloneDir, repo, ref } satisfies CloneResult,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error cloning ${repo}: ${message}`,
          },
        ],
        details: { error: message, repo },
      };
    }
  },
};
