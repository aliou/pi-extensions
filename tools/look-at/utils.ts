import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { TextContent, UserMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Matches image file extensions, lookahead ensures the extension is at
// a word/sentence boundary (space, punctuation, or end of string).
const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp)(?=[\s"'`,;)\]\\!?\]]|$)/gi;

/**
 * Check if user message text references any local image files that exist on disk.
 *
 * Extracts candidate paths from text and verifies each one actually exists.
 * This naturally filters out URLs (which won't resolve to local files)
 * and non-existent paths (prose that happens to contain an image extension).
 */
export function referencesImageFiles(text: string, cwd: string): boolean {
  return findReferencedImageFiles(text, cwd).length > 0;
}

export function findReferencedImageFiles(text: string, cwd: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  // Reset lastIndex — the module-level regex has the global flag,
  // so lastIndex persists between calls. Without this, consecutive
  // calls can skip matches.
  IMAGE_EXT_RE.lastIndex = 0;

  let match = IMAGE_EXT_RE.exec(text);
  while (match !== null) {
    const extEnd = match.index + match[0].length;

    // Extract candidate: from last whitespace boundary to extension end
    let start = match.index;
    while (start > 0 && !/\s/.test(text[start - 1] ?? "")) start--;
    let candidate = text.slice(start, extEnd);
    let resolved = resolveExistingPath(candidate, cwd);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      paths.push(resolved);
      match = IMAGE_EXT_RE.exec(text);
      continue;
    }

    // Try extending backward through spaces to handle paths with spaces
    // (e.g. macOS screenshot paths like
    //   /Users/foo/Screenshot 2026-03-01 at 08.49.52 PM@2x.png)
    // Only try if there is a "/" somewhere before the candidate in the
    // current line, suggesting this could be a continuation of a filesystem path.
    const lineStart = text.lastIndexOf("\n", start) + 1;
    const textBefore = text.slice(lineStart, start);
    if (candidate.includes("/") || textBefore.includes("/")) {
      let extended = start;
      while (extended > 0) {
        const prevSpace = text.lastIndexOf(" ", extended - 2);
        if (prevSpace < 0) {
          extended = 0;
        } else {
          // Stop at newlines — paths don't span across lines
          if (text[prevSpace - 1] === "\n") break;
          extended = prevSpace + 1;
        }
        candidate = text.slice(extended, extEnd);
        resolved = resolveExistingPath(candidate, cwd);
        if (resolved && !seen.has(resolved)) {
          seen.add(resolved);
          paths.push(resolved);
          break;
        }
      }
    }

    match = IMAGE_EXT_RE.exec(text);
  }

  return paths;
}

function resolveExistingPath(filePath: string, cwd: string): string | null {
  if (filePath.startsWith("~")) {
    filePath = filePath.replace(/^~/, homedir());
  }
  if (!filePath.startsWith("/")) {
    filePath = resolve(cwd, filePath);
  }
  return existsSync(filePath) ? filePath : null;
}

export function detectSupportedImageMimeType(
  buffer: Uint8Array,
): string | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return buffer[3] === 0xf7 ? null : "image/jpeg";
  }
  if (startsWith(buffer, PNG_SIGNATURE)) {
    return isPng(buffer) && !isAnimatedPng(buffer) ? "image/png" : null;
  }
  if (startsWithAscii(buffer, 0, "GIF")) {
    return "image/gif";
  }
  if (
    startsWithAscii(buffer, 0, "RIFF") &&
    startsWithAscii(buffer, 8, "WEBP")
  ) {
    return "image/webp";
  }
  return null;
}

export function isVisionCapable(model: { input: string[] }): boolean {
  return model.input.includes("image");
}

/** Extract the concatenated text of a user message's content. */
function userMessageText(content: UserMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function buildLookAtGuidance(paths: string[]): string {
  const list = paths.map((path) => `- ${path}`).join("\n");
  return `The user referenced image files. You cannot see images directly; use the look_at tool to analyze each one before answering.\n\nImages:\n${list}`;
}

/**
 * If the last message is a user message referencing local image files, append
 * look_at guidance to it. Mutates the message in place (the context event
 * provides a deep copy). Returns true when guidance was added.
 */
export function injectLookAtGuidance(
  messages: AgentMessage[],
  cwd: string,
): boolean {
  const last = messages.at(-1);
  if (!last || last.role !== "user") return false;

  const paths = findReferencedImageFiles(userMessageText(last.content), cwd);
  if (paths.length === 0) return false;

  const guidance = buildLookAtGuidance(paths);
  if (typeof last.content === "string") {
    last.content = `${last.content}\n\n${guidance}`;
  } else if (Array.isArray(last.content)) {
    last.content = [...last.content, { type: "text", text: guidance }];
  }
  return true;
}

export function disableTool(pi: ExtensionAPI, toolName: string): void {
  pi.setActiveTools(pi.getActiveTools().filter((t) => t !== toolName));
}

function isPng(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 16 &&
    readUint32BE(buffer, PNG_SIGNATURE.length) === 13 &&
    startsWithAscii(buffer, 12, "IHDR")
  );
}

function isAnimatedPng(buffer: Uint8Array): boolean {
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= buffer.length) {
    const chunkLength = readUint32BE(buffer, offset);
    const chunkTypeOffset = offset + 4;
    if (startsWithAscii(buffer, chunkTypeOffset, "acTL")) return true;
    if (startsWithAscii(buffer, chunkTypeOffset, "IDAT")) return false;

    const nextOffset = offset + 8 + chunkLength + 4;
    if (nextOffset <= offset || nextOffset > buffer.length) return false;
    offset = nextOffset;
  }
  return false;
}

function readUint32BE(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] ?? 0) * 0x1000000 +
    ((buffer[offset + 1] ?? 0) << 16) +
    ((buffer[offset + 2] ?? 0) << 8) +
    (buffer[offset + 3] ?? 0)
  );
}

function startsWith(buffer: Uint8Array, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function startsWithAscii(
  buffer: Uint8Array,
  offset: number,
  text: string,
): boolean {
  if (buffer.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index++) {
    if (buffer[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}
