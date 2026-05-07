import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { encodePathSegments } from "@harness/utils/path";
import { Type } from "typebox";
import type { GitHubClient } from "../lib/github-client";
import {
  normalizeRepository,
  parseJson,
  textResult,
} from "../lib/github-client";

const Params = Type.Object({
  path: Type.String({
    description: "Path within the selected repository to read",
  }),
  read_range: Type.Optional(
    Type.Array(Type.Number(), {
      minItems: 2,
      maxItems: 2,
      description:
        "Optional [start_line, end_line] to limit the read to specific lines",
    }),
  ),
  repository: Type.String({
    description:
      'Single GitHub repository to read from. Use "owner/repo" or "https://github.com/owner/repo". Do not pass GitHub search pages such as "https://github.com/search".',
  }),
});

interface ContentResponse {
  content: string;
  encoding: string;
  type?: string;
}

interface DirectoryEntry {
  name: string;
  type: "file" | "dir" | string;
}

const MAX_READ_BYTES = 128 * 1024;

export function createReadGitHubTool(
  client: GitHubClient,
  cwd: string,
): ToolDefinition<typeof Params> {
  return {
    name: "read_github",
    label: "Read GitHub",
    description: `Read a file from a GitHub repository.
If the path resolves to a directory, return a directory listing instead.

Use this when you need the contents of a specific file, or a quick listing for a path that may be a file or directory.

Returned file contents include line numbers. Directory listings use a trailing "/" for subdirectories. Files larger than 128KB require read_range.`,
    parameters: Params,
    async execute(_id, params, signal) {
      const repository = normalizeRepository(params.repository);
      const path = params.path.replace(/^\//, "");
      const encodedPath = encodePathSegments(path);
      const json = await client.api(
        `repos/${repository}/contents/${encodedPath}`,
        cwd,
        { signal },
      );
      const data = parseJson<ContentResponse | DirectoryEntry[]>(json);

      if (Array.isArray(data)) {
        const entries = data
          .map((entry) =>
            entry.type === "dir" ? `${entry.name}/` : entry.name,
          )
          .sort();
        const text = entries.join("\n");
        if (Buffer.byteLength(text, "utf8") > MAX_READ_BYTES) {
          throw new Error(
            `Directory listing is too large (${Math.round(Buffer.byteLength(text, "utf8") / 1024)}KB). Use read_range or list_directory_github with a limit.`,
          );
        }
        return textResult(text, { entries, isDirectory: true });
      }

      if (!data.content || !data.encoding) {
        throw new Error(
          `Cannot read "${path || "/"}" because GitHub returned ${data.type ?? "unsupported"} metadata instead of file contents.`,
        );
      }

      const decoded =
        data.encoding === "base64"
          ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString(
              "utf8",
            )
          : data.content;
      const lines = decoded.split("\n");
      const start = params.read_range?.[0] ?? 1;
      const end = params.read_range?.[1] ?? lines.length;
      const content = lines
        .slice(Math.max(0, start - 1), end)
        .map((line, index) => `${start + index}: ${line}`)
        .join("\n");
      if (Buffer.byteLength(content, "utf8") > MAX_READ_BYTES) {
        throw new Error(
          `File is too large (${Math.round(Buffer.byteLength(content, "utf8") / 1024)}KB). The file has ${lines.length} lines. Please retry with read_range.`,
        );
      }
      return textResult(content, {
        path,
        range: [start, end],
        lineCount: lines.length,
      });
    },
  };
}
