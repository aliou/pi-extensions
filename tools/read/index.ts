import {
  constants,
  access as fsAccess,
  readFile as fsReadFile,
  lstat,
} from "node:fs/promises";
import { resolve } from "node:path";
import type {
  AgentToolResult,
  ExtensionAPI,
  ReadToolDetails,
} from "@earendil-works/pi-coding-agent";
import {
  createLsTool,
  createReadToolDefinition,
  getMarkdownTheme,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { Markdown, Text } from "@earendil-works/pi-tui";
import {
  convertBmpToPng,
  detectImageMimeType,
  isBmpBuffer,
} from "@harness/image-formats";

/**
 * Override the built-in read tool to handle directories, BMP images, and
 * markdown rendering.
 *
 * - If the path is a directory, delegate to the native `ls` tool instead of
 *   throwing EISDIR.
 * - BMP files are converted to PNG before upstream image processing.
 * - Markdown files (`.md`, `.markdown`) are rendered as formatted markdown
 *   (headings, lists, code blocks, links) when expanded and non-error. All
 *   other cases delegate to the native read renderer, so non-markdown files
 *   keep byte-for-byte native behavior.
 */
export default function (pi: ExtensionAPI): void {
  const cwd = process.cwd();
  const autoResizeImages = SettingsManager.create(cwd).getImageAutoResize();

  const nativeDef = createReadToolDefinition(cwd, {
    autoResizeImages,
    operations: {
      access: (absolutePath) => fsAccess(absolutePath, constants.R_OK),
      readFile: async (absolutePath) => {
        const buffer = await fsReadFile(absolutePath);
        if (isBmpBuffer(buffer)) {
          return convertBmpToPng(buffer);
        }
        return buffer;
      },
      detectImageMimeType: async (absolutePath) => {
        const mime = await detectImageMimeType(absolutePath);
        // Report BMP as PNG because the bytes we hand to upstream are PNG.
        return mime === "image/bmp" ? "image/png" : mime;
      },
    },
  });
  const nativeLs = createLsTool(cwd);
  const mdTheme = getMarkdownTheme();

  pi.registerTool({
    ...nativeDef,
    description: nativeDef.description.replace(
      /\(jpg, png, gif, webp\)/,
      "(jpg, png, gif, webp, bmp)",
    ),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const { path } = params;
      const absolutePath = resolve(ctx.cwd, path);

      try {
        const stat = await lstat(absolutePath);

        if (stat.isDirectory()) {
          return nativeLs.execute(toolCallId, { path }, signal, onUpdate);
        }
      } catch (_error) {
        void _error;
        // Path does not exist or cannot be accessed - let nativeDef handle the error
      }

      return nativeDef.execute(toolCallId, params, signal, onUpdate, ctx);
    },
    renderResult(result, options, theme, context) {
      const rawPath = strPath(context.args?.path);
      const isMarkdown = isMarkdownPath(rawPath);
      const expanded = options.expanded;
      const isError = context.isError;

      if (isMarkdown && expanded && !isError) {
        // Render the file text as formatted markdown instead of highlighted source.
        const text = readTextOutput(result);
        const existing = context.lastComponent;
        if (existing instanceof Markdown) {
          existing.setText(text);
          return existing;
        }
        return new Markdown(text, 0, 0, mdTheme);
      }

      // Delegate everything else to the native read renderer. Never hand the
      // native renderer a non-Text lastComponent: it casts lastComponent to
      // Text and calls setText, which would double-process a Markdown instance.
      const lastComponent =
        context.lastComponent instanceof Text
          ? context.lastComponent
          : undefined;
      const nativeCtx =
        lastComponent === context.lastComponent
          ? context
          : { ...context, lastComponent };
      return (
        nativeDef.renderResult?.(
          result as AgentToolResult<ReadToolDetails | undefined>,
          options,
          theme,
          nativeCtx,
        ) ?? new Text("", 0, 0)
      );
    },
  });
}

function isMarkdownPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "md" || ext === "markdown";
}

function strPath(value: unknown): string | null {
  if (typeof value === "string") return value;
  return null;
}

function readTextOutput(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
}
