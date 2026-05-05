/**
 * Read URL fetch logic and image handling.
 */

import { writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { ReadUrlHandler } from "./handlers";
import type { HandlerImage } from "./handlers/types";
import type {
  ExecuteResult,
  FetchLike,
  NativeReadTool,
  ReadContentBlock,
} from "./types";
import { writeTempFilePreview } from "./utils/temp-file-preview";

export async function executeReadUrlRequest(
  input: string,
  signal: AbortSignal | undefined,
  handlers: ReadUrlHandler[],
  nativeRead: NativeReadTool,
  fetchImpl: FetchLike = fetch,
): Promise<ExecuteResult> {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    throw new Error("url is required");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedInput);
  } catch {
    throw new Error(`Invalid URL: ${trimmedInput}`);
  }

  const handler = handlers.find((candidate) => candidate.matches(parsedUrl));
  if (!handler) {
    throw new Error("No handler available for this URL");
  }

  const data = await handler.fetchData(parsedUrl, signal);
  const markdown = data.markdown;

  // Write full content to a temp file so the agent can read it with offset/limit.
  // Only the preview goes into the LLM context to avoid blowing it up.
  const { preview, tempFilePath, totalLines } = await writeTempFilePreview(
    markdown,
    { slug: trimmedInput },
  );

  const content: ReadContentBlock[] = [{ type: "text", text: preview }];

  let attachedImageCount = 0;
  let skippedImageCount = 0;
  const images = data.images ?? [];

  if (images.length > 0) {
    const tempDir = join(tempFilePath, "..");
    for (const [index, image] of images.entries()) {
      try {
        const tempPath = await fetchRemoteImageToTempFile(
          image,
          tempDir,
          index,
          signal,
          fetchImpl,
        );

        const imageResult = await nativeRead.execute(
          `read-url-image-${index + 1}`,
          { path: tempPath },
          signal,
          undefined,
        );

        if (
          !imageResult ||
          typeof imageResult !== "object" ||
          !("content" in imageResult) ||
          !Array.isArray(imageResult.content) ||
          ("isError" in imageResult && imageResult.isError)
        ) {
          skippedImageCount += 1;
          continue;
        }

        content.push(...(imageResult.content as ReadContentBlock[]));
        attachedImageCount += 1;
      } catch {
        skippedImageCount += 1;
      }
    }
  }

  return {
    content,
    details: {
      url: trimmedInput,
      sourceUrl: data.sourceUrl,
      title: data.title,
      handler: handler.name,
      statusCode: data.statusCode,
      statusText: data.statusText,
      failed: false,
      imageCount: images.length,
      attachedImageCount,
      skippedImageCount,
      tempFilePath,
      totalLines,
    },
  };
}

async function fetchRemoteImageToTempFile(
  image: HandlerImage,
  tempDir: string,
  index: number,
  signal: AbortSignal | undefined,
  fetchImpl: FetchLike,
): Promise<string> {
  const response = await fetchImpl(image.sourceUrl, { signal });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText || "Error"} while fetching image`,
    );
  }

  const contentType = response.headers.get("content-type");
  const extension = guessImageExtension(contentType, image.sourceUrl);
  const bytes = Buffer.from(await response.arrayBuffer());
  const baseName = sanitizeTempBaseName(
    image.label ||
      basename(new URL(image.sourceUrl).pathname) ||
      `image-${index + 1}`,
  );
  const tempPath = join(tempDir, `${index + 1}-${baseName}${extension}`);

  await writeFile(tempPath, bytes);
  return tempPath;
}

export function guessImageExtension(
  contentType: string | null | undefined,
  imageUrl: string,
): string {
  const normalizedContentType = contentType
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  const byContentType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/svg+xml": ".svg",
  };

  if (normalizedContentType && byContentType[normalizedContentType]) {
    return byContentType[normalizedContentType];
  }

  try {
    const pathname = new URL(imageUrl).pathname;
    const extension = extname(pathname).toLowerCase();
    if (extension) {
      return extension;
    }
  } catch {
    // Ignore invalid URL here. Caller already validated/fetched it.
  }

  return ".img";
}

function sanitizeTempBaseName(value: string): string {
  return value.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9_-]+/gi, "-");
}
