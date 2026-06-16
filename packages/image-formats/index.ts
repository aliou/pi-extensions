import { open } from "node:fs/promises";
import { convertToPng } from "@earendil-works/pi-coding-agent";

const IMAGE_TYPE_SNIFF_BYTES = 4100;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type ImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "image/bmp";

/**
 * Detect the actual image MIME type of a file by sniffing its header.
 *
 * Mirrors the upstream Pi detector and adds BMP support.
 */
export async function detectImageMimeType(
  filePath: string,
): Promise<ImageMimeType | null> {
  const fileHandle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(IMAGE_TYPE_SNIFF_BYTES);
    const { bytesRead } = await fileHandle.read(
      buffer,
      0,
      IMAGE_TYPE_SNIFF_BYTES,
      0,
    );
    return detectImageMimeTypeFromBuffer(buffer.subarray(0, bytesRead));
  } finally {
    await fileHandle.close();
  }
}

export function detectImageMimeTypeFromBuffer(
  buffer: Uint8Array,
): ImageMimeType | null {
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
  if (isBmpBuffer(buffer)) {
    return "image/bmp";
  }
  return null;
}

/**
 * Convert a BMP buffer to PNG using Photon.
 */
export async function convertBmpToPng(buffer: Buffer): Promise<Buffer> {
  const png = await convertToPng(buffer.toString("base64"), "image/bmp");
  if (!png) {
    throw new Error("Could not convert BMP image to PNG");
  }
  return Buffer.from(png.data, "base64");
}

/**
 * Check whether a byte buffer starts with the BMP magic bytes.
 *
 * Requires at least the 14-byte BITMAPFILEHEADER so tiny text files that happen
 * to start with "BM" are not mistaken for images.
 */
export function isBmpBuffer(buffer: Uint8Array): boolean {
  return buffer.length >= 14 && startsWithAscii(buffer, 0, "BM");
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
    (buffer[offset] ?? 0) * 0x1_0000_00 +
    ((buffer[offset + 1] ?? 0) << 16) +
    ((buffer[offset + 2] ?? 0) << 8) +
    (buffer[offset + 3] ?? 0)
  );
}
