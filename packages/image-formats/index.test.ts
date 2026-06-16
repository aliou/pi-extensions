import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

vi.mock("@earendil-works/pi-coding-agent", () => ({
  convertToPng: vi.fn(),
}));

import { convertToPng } from "@earendil-works/pi-coding-agent";
import {
  convertBmpToPng,
  detectImageMimeTypeFromBuffer,
  isBmpBuffer,
} from "./index";

function createMinimalBmp(): Buffer {
  const buffer = Buffer.alloc(58);
  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(58, 2); // file size
  buffer.writeUInt16LE(0, 6); // reserved1
  buffer.writeUInt16LE(0, 8); // reserved2
  buffer.writeUInt32LE(54, 10); // pixel data offset

  // BITMAPINFOHEADER
  buffer.writeUInt32LE(40, 14); // DIB header size
  buffer.writeInt32LE(1, 18); // width
  buffer.writeInt32LE(1, 22); // height
  buffer.writeUInt16LE(1, 26); // planes
  buffer.writeUInt16LE(24, 28); // bits per pixel
  buffer.writeUInt32LE(0, 30); // compression
  buffer.writeUInt32LE(4, 34); // image size

  return buffer;
}

describe("detectImageMimeTypeFromBuffer", () => {
  it("detects JPEG", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageMimeTypeFromBuffer(buffer)).toBe("image/jpeg");
  });

  it("detects PNG", () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);
    expect(detectImageMimeTypeFromBuffer(buffer)).toBe("image/png");
  });

  it("detects GIF", () => {
    const buffer = Buffer.from("GIF89a");
    expect(detectImageMimeTypeFromBuffer(buffer)).toBe("image/gif");
  });

  it("detects WebP", () => {
    const buffer = Buffer.from("RIFFxxxxWEBP");
    expect(detectImageMimeTypeFromBuffer(buffer)).toBe("image/webp");
  });

  it("detects BMP", () => {
    expect(detectImageMimeTypeFromBuffer(createMinimalBmp())).toBe("image/bmp");
  });

  it("returns null for plain text", () => {
    expect(
      detectImageMimeTypeFromBuffer(Buffer.from("hello world")),
    ).toBeNull();
  });
});

describe("isBmpBuffer", () => {
  it("returns true for a minimal BMP", () => {
    expect(isBmpBuffer(createMinimalBmp())).toBe(true);
  });

  it("returns false for a tiny BM prefix", () => {
    expect(isBmpBuffer(Buffer.from("BM"))).toBe(false);
  });
});

describe("convertBmpToPng", () => {
  it("converts a BMP buffer to PNG", async () => {
    const input = createMinimalBmp();
    const pngBase64 = Buffer.from("pngdata").toString("base64");
    vi.mocked(convertToPng).mockResolvedValue({
      data: pngBase64,
      mimeType: "image/png",
    });

    const result = await convertBmpToPng(input);

    expect(convertToPng).toHaveBeenCalledWith(
      input.toString("base64"),
      "image/bmp",
    );
    expect(result).toEqual(Buffer.from("pngdata"));
  });

  it("throws when Photon cannot convert", async () => {
    vi.mocked(convertToPng).mockResolvedValue(null);

    await expect(convertBmpToPng(createMinimalBmp())).rejects.toThrow(
      "Could not convert BMP image to PNG",
    );
  });
});
