/**
 * Read files from a cloned repository.
 *
 * Paths are scoped to the clone directory — paths outside the clone are rejected.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { getCloneDir } from "./clone-repo";

const MAX_FILE_SIZE = 512 * 1024; // 512 KB

const parameters = Type.Object({
  repo: Type.String({
    description:
      "Repository in owner/repo format (must be cloned first with clone_repo)",
  }),
  path: Type.String({
    description:
      "File path relative to the repo root (e.g., 'src/index.ts', 'README.md')",
  }),
});

export const repoReadTool: ToolDefinition<typeof parameters> = {
  name: "repo_read",
  label: "Repo Read",
  description: `Read a file from a previously cloned repository.

The repository must be cloned first using clone_repo. Paths are scoped to the clone directory — you cannot read files outside the cloned repo.

Examples:
- repo_read(repo="openai/codex", path="README.md")
- repo_read(repo="facebook/react", path="packages/react/src/React.js")`,

  parameters,

  async execute(
    _toolCallId: string,
    args: { repo: string; path: string },
    _signal: AbortSignal | undefined,
  ) {
    const { repo, path: filePath } = args;

    const cloneDir = getCloneDir(repo);
    if (!cloneDir) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Repository ${repo} has not been cloned. Use clone_repo first.`,
          },
        ],
        details: { error: "not_cloned", repo },
      };
    }

    // Resolve and validate the path stays within cloneDir
    const resolvedPath = join(cloneDir, filePath);
    const relativePath = relative(cloneDir, resolvedPath);

    if (relativePath.startsWith("..") || relativePath.startsWith("/")) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Path '${filePath}' is outside the cloned repository. All paths must be relative to the repo root.`,
          },
        ],
        details: { error: "path_escape", repo, path: filePath },
      };
    }

    try {
      const fileStat = await stat(resolvedPath);

      if (fileStat.isDirectory()) {
        // List directory contents
        const entries = await readdir(resolvedPath, { withFileTypes: true });
        const lines = entries
          .sort((a, b) => {
            // Directories first, then files
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          })
          .map((entry) =>
            entry.isDirectory() ? `${entry.name}/` : entry.name,
          );
        return {
          content: [
            {
              type: "text" as const,
              text: lines.join("\n") || "(empty directory)",
            },
          ],
          details: { repo, path: filePath, type: "directory" },
        };
      }

      if (fileStat.size > MAX_FILE_SIZE) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: File '${filePath}' is ${Math.round(fileStat.size / 1024)}KB, exceeding the ${MAX_FILE_SIZE / 1024}KB limit. Use the GitHub API tools or request specific line ranges.`,
            },
          ],
          details: {
            error: "file_too_large",
            repo,
            path: filePath,
            sizeBytes: fileStat.size,
          },
        };
      }

      const content = await readFile(resolvedPath, "utf-8");
      const fileName = basename(resolvedPath);
      const lineCount = content.split("\n").length;

      return {
        content: [
          {
            type: "text" as const,
            text: `// ${filePath} (${lineCount} lines)\n${content}`,
          },
        ],
        details: { repo, path: filePath, type: "file", fileName, lineCount },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: File not found: ${filePath}`,
            },
          ],
          details: { error: "not_found", repo, path: filePath },
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error reading ${filePath}: ${message}`,
          },
        ],
        details: { error: message, repo, path: filePath },
      };
    }
  },
};
