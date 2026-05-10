import type {
  ExtensionAPI,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execGit } from "./git-exec";

const DEFAULT_MAX_BYTES = 64 * 1024; // 64KB

const Params = Type.Object({
  repoPath: Type.String({
    description: "Absolute path to the local repository (from checkout_repo).",
  }),
  rev: Type.String({
    description:
      'Commit SHA, branch, or tag to inspect (e.g. "abc1234", "main", "v1.0.0").',
  }),
  path: Type.Optional(
    Type.String({
      description:
        "Optional file or directory path within the commit to inspect. Restricts diff output to this path.",
    }),
  ),
  includePatch: Type.Optional(
    Type.Boolean({
      description:
        "Include the unified diff patch. Default true. Set false for metadata-only (sha, author, date, stats).",
    }),
  ),
  maxBytes: Type.Optional(
    Type.Number({
      description:
        "Maximum output size in bytes. Default 65536. Output beyond this is truncated with a hint to narrow by path.",
      minimum: 1024,
      maximum: 512 * 1024,
    }),
  ),
});

function textResult(text: string, details?: unknown) {
  return { content: [{ type: "text" as const, text }], details };
}

export function createGitShowTool(
  pi: ExtensionAPI,
  _cwd: string,
): ToolDefinition<typeof Params> {
  return {
    name: "git_show",
    label: "Git Show",
    description: `Inspect a commit, tag, or branch in a local repository.

With includePatch=true (default), returns commit metadata + file stats + diff.
With includePatch=false, returns only commit metadata + file stats (no diff).

Use checkout_repo first if the repository is remote.`,
    parameters: Params,
    async execute(_id, params, signal) {
      const includePatch = params.includePatch ?? true;
      const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES;

      const args = ["show"];

      if (!includePatch) {
        args.push("--no-patch", "--stat");
      } else {
        args.push("--stat", "--patch");
      }

      args.push(params.rev);

      if (params.path) {
        args.push("--", params.path);
      }

      const result = await execGit(pi, args, params.repoPath, signal);

      if (result.code !== 0) {
        const msg = result.stderr.trim() || result.stdout.trim();
        throw new Error(`git show failed: ${msg}`);
      }

      let output = result.stdout.trimEnd();
      const outputBytes = Buffer.byteLength(output, "utf8");

      if (outputBytes > maxBytes) {
        const truncated = output.slice(0, maxBytes);
        const hint = params.path
          ? "Narrow the path further to reduce output."
          : "Use the path parameter to restrict the diff to specific files.";
        output = `${truncated}\n\n... [output truncated: ${Math.round(outputBytes / 1024)}KB total] ${hint}`;
      }

      return textResult(output, {
        rev: params.rev,
        includePatch,
        truncated: outputBytes > maxBytes,
      });
    },
  };
}
