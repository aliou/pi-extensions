import {
  constants,
  access as fsAccess,
  readFile as fsReadFile,
  lstat,
} from "node:fs/promises";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createLsTool,
  createReadTool,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import {
  convertBmpToPng,
  detectImageMimeType,
  isBmpBuffer,
} from "@harness/image-formats";

/**
 * Override the built-in read tool to handle directories and BMP images.
 *
 * - If the path is a directory, delegate to the native `ls` tool instead of
 *   throwing EISDIR.
 * - BMP files are converted to PNG before upstream image processing.
 */
export default function (pi: ExtensionAPI): void {
  const cwd = process.cwd();
  const autoResizeImages = SettingsManager.create(cwd).getImageAutoResize();

  const nativeRead = createReadTool(cwd, {
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

  pi.registerTool({
    ...nativeRead,
    description: nativeRead.description.replace(
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
        // Path does not exist or cannot be accessed - let nativeRead handle the error
      }

      return nativeRead.execute(toolCallId, params, signal, onUpdate);
    },
  });
}
