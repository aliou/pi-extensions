import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { ToolCallHeader } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import {
  createReadTool,
  getMarkdownTheme,
  keyText,
} from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import {
  createGistHandler,
  createGitHubHandler,
  createMarkdownNewHandler,
  createTwitterHandler,
  type ReadUrlHandler,
} from "./read-url/handlers";
import type { HandlerImage } from "./read-url/handlers/types";

const ReadUrlParams = Type.Object({
  url: Type.String({
    description: "URL to fetch as Markdown via markdown.new",
  }),
});

type ReadUrlParamsType = Static<typeof ReadUrlParams>;

type NativeReadTool = ReturnType<typeof createReadTool>;
type ReadContentBlock = ExecuteResult["content"][number];

type FetchLike = typeof fetch;

interface ReadUrlDetails {
  url: string;
  sourceUrl: string;
  title?: string;
  handler: string;
  statusCode?: number;
  statusText?: string;
  failed: boolean;
  imageCount?: number;
  attachedImageCount?: number;
  skippedImageCount?: number;
}

type ExecuteResult = AgentToolResult<ReadUrlDetails>;

const COLLAPSED_PREVIEW_LINES = 8;

export async function executeReadUrlRequest(
  input: string,
  signal: AbortSignal | undefined,
  handlers: ReadUrlHandler[],
  nativeRead: Pick<NativeReadTool, "execute">,
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
  const content: ReadContentBlock[] = [{ type: "text", text: data.markdown }];

  let attachedImageCount = 0;
  let skippedImageCount = 0;
  const images = data.images ?? [];

  if (images.length > 0) {
    const tempDir = await mkdtemp(join(tmpdir(), "read-url-"));

    try {
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
    } finally {
      await rm(tempDir, { recursive: true, force: true });
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
    },
  };
}

export function setupReadUrlTool(pi: ExtensionAPI): void {
  const handlers: ReadUrlHandler[] = [
    createTwitterHandler(),
    createGitHubHandler(),
    createGistHandler(),
    createMarkdownNewHandler(),
  ];
  const nativeRead = createReadTool(process.cwd());

  pi.registerTool<typeof ReadUrlParams, ReadUrlDetails>({
    name: "read_url",
    label: "Read URL",
    description:
      "Fetch a URL as Markdown via handlers with markdown.new fallback.",
    parameters: ReadUrlParams,

    async execute(
      _toolCallId: string,
      params: ReadUrlParamsType,
      signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: ExtensionContext,
    ): Promise<ExecuteResult> {
      return executeReadUrlRequest(
        params.url,
        signal,
        handlers,
        nativeRead,
        fetch,
      );
    },

    renderCall(args: ReadUrlParamsType, theme: Theme) {
      return new ToolCallHeader(
        {
          toolName: "Read URL",
          mainArg: args.url.trim(),
          showColon: true,
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<ReadUrlDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      if (options.isPartial) {
        return new Text(theme.fg("muted", "Read URL: fetching..."), 0, 0);
      }

      const isError = Boolean((result as { isError?: boolean }).isError);
      const textBlock = result.content.find((c) => c.type === "text");
      const markdownText =
        textBlock?.type === "text" && textBlock.text ? textBlock.text : "";

      const container = new Container();

      if (isError) {
        const errorText = markdownText || "Read URL failed";
        container.addChild(new Text(theme.fg("error", errorText), 0, 0));
      } else if (markdownText) {
        const collapsed = !options.expanded;

        if (collapsed) {
          const lines = markdownText.split("\n");
          const visibleText = lines
            .slice(0, COLLAPSED_PREVIEW_LINES)
            .join("\n");
          const remaining = Math.max(lines.length - COLLAPSED_PREVIEW_LINES, 0);

          container.addChild(
            new Markdown(visibleText, 0, 0, getMarkdownTheme(), {
              color: (text: string) => theme.fg("toolOutput", text),
            }),
          );

          if (remaining > 0) {
            container.addChild(
              new Text(
                theme.fg(
                  "muted",
                  `... (${remaining} more lines, ${keyText("app.tools.expand")} to expand)`,
                ),
                0,
                0,
              ),
            );
          }
        } else {
          container.addChild(
            new Markdown(markdownText, 0, 0, getMarkdownTheme(), {
              color: (text: string) => theme.fg("toolOutput", text),
            }),
          );
        }
      } else {
        container.addChild(
          new Text(theme.fg("muted", "Read URL: no content"), 0, 0),
        );
      }

      const status = result.details?.statusCode
        ? `${result.details.statusCode}${
            result.details.statusText ? ` ${result.details.statusText}` : ""
          }`
        : "n/a";
      const failed = isError || result.details?.failed === true ? "yes" : "no";
      const handler = result.details?.handler ?? "unknown";

      container.addChild(new Text("", 0, 0));
      container.addChild(
        new Text(
          `${theme.fg("muted", "handler=")}${theme.fg("dim", handler)}  ${theme.fg("muted", "HTTP:")} ${theme.fg("dim", status)}  ${theme.fg("muted", "failed=")}${theme.fg(failed === "yes" ? "error" : "success", failed)}`,
          0,
          0,
        ),
      );

      return container;
    },
  });
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
