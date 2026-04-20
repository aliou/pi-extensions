import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TempFilePreviewResult {
  preview: string;
  tempFilePath: string;
  totalLines: number;
}

export async function writeTempFilePreview(
  content: string,
  options: { slug: string; previewLines?: number; prefix?: string },
): Promise<TempFilePreviewResult> {
  const previewLines = options.previewLines ?? 10;
  const prefix = options.prefix ?? "pi-tool-";

  const lines = content.split("\n");
  const totalLines = lines.length;

  // Write full content to a temp file.
  const tempDir = await mkdtemp(join(tmpdir(), prefix));
  const safeName = options.slug
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const tempFilePath = join(tempDir, `${safeName}.md`);
  await writeFile(tempFilePath, content, "utf-8");

  // Build the preview: first N lines + file path hint if truncated.
  const previewContentLines = lines.slice(0, previewLines);
  const remaining = Math.max(totalLines - previewLines, 0);
  let preview = previewContentLines.join("\n");
  if (remaining > 0) {
    preview += `\n\n... (${remaining} more lines) Full content at: ${tempFilePath}`;
  }

  return {
    preview,
    tempFilePath,
    totalLines,
  };
}
