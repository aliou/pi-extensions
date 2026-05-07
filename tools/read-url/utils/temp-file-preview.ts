import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
} from "@earendil-works/pi-coding-agent";

export {
  DEFAULT_MAX_BYTES as DEFAULT_PREVIEW_MAX_BYTES,
  DEFAULT_MAX_LINES as DEFAULT_PREVIEW_MAX_LINES,
} from "@earendil-works/pi-coding-agent";

export interface TempFilePreviewResult {
  preview: string;
  tempFilePath: string;
  totalLines: number;
}

export interface TempFilePreviewOptions {
  slug: string;
  /** Max preview lines (default: 2000). Whichever limit is hit first wins. */
  maxLines?: number;
  /** Max preview size in bytes (default: 50KB). Whichever limit is hit first wins. */
  maxBytes?: number;
  prefix?: string;
}

export async function writeTempFilePreview(
  content: string,
  options: TempFilePreviewOptions,
): Promise<TempFilePreviewResult> {
  const prefix = options.prefix ?? "pi-tool-";
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  const totalLines = content.split("\n").length;

  // Write full content to a temp file.
  const tempDir = await mkdtemp(join(tmpdir(), prefix));
  const safeName = options.slug
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const tempFilePath = join(tempDir, `${safeName}.md`);
  await writeFile(tempFilePath, content, "utf-8");

  const result = truncateHead(content, { maxLines, maxBytes });

  let preview = result.content;
  if (result.truncated) {
    preview += `\n\n... (truncated, ${totalLines} total lines, ${formatSize(result.totalBytes)}) Full content at: ${tempFilePath}`;
  }

  return {
    preview,
    tempFilePath,
    totalLines,
  };
}
