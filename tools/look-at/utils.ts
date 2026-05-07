import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Check if user message text references any image files. */
export function referencesImageFiles(text: string): boolean {
  return /\.(?:png|jpe?g|gif|webp|bmp|svg)(?:[\s"'`,;)\]\\]|$)/i.test(text);
}

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

export function mimeTypeFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_TO_MIME[ext] ?? null;
}

export function isVisionCapable(model: { input: string[] }): boolean {
  return model.input.includes("image");
}

export function disableTool(pi: ExtensionAPI, toolName: string): void {
  pi.setActiveTools(pi.getActiveTools().filter((t) => t !== toolName));
}
