import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectSupportedImageMimeType, referencesImageFiles } from "./utils";

describe("referencesImageFiles", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    // temp dirs cleaned up by OS, just clear the ref list
    tmpDirs.length = 0;
  });

  function makeTemp(filename: string, content: Buffer): string {
    const dir = mkdtempSync(join(homedir(), ".pi-test-"));
    tmpDirs.push(dir);
    const filePath = join(dir, filename);
    writeFileSync(filePath, content);
    return filePath;
  }

  it("detects an existing .png file path", () => {
    const pngSig = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);
    const path = makeTemp("test.png", pngSig);
    expect(referencesImageFiles(`check out ${path}`, "/tmp")).toBe(true);
  });

  it("detects an existing .jpg file path", () => {
    const jpgSig = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const path = makeTemp("photo.jpg", jpgSig);
    expect(referencesImageFiles(`look at ${path}`, "/tmp")).toBe(true);
  });

  it("detects an existing relative path", () => {
    const pngSig = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);
    const dir = mkdtempSync(join(homedir(), ".pi-test-"));
    tmpDirs.push(dir);
    writeFileSync(join(dir, "image.png"), pngSig);
    const relPath = "image.png";
    expect(referencesImageFiles(`check ${relPath}`, dir)).toBe(true);
  });

  it("detects existing path with spaces (macOS screenshot style)", () => {
    const pngSig = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);
    const dir = mkdtempSync(join(homedir(), ".pi-test-"));
    tmpDirs.push(dir);
    const fileName = "Screenshot 2026-03-01 at 08.49.52 PM@2x.png";
    writeFileSync(join(dir, fileName), pngSig);
    const fullPath = join(dir, fileName);
    expect(
      referencesImageFiles(
        `why does it break? ${fullPath} on submit it showed mine`,
        "/tmp",
      ),
    ).toBe(true);
  });

  it("does NOT match a non-existent path", () => {
    expect(
      referencesImageFiles("/Users/nonexistent/nope/screenshot.png", "/tmp"),
    ).toBe(false);
  });

  it("does NOT match a URL with .png", () => {
    expect(
      referencesImageFiles("curl https://example.com/assets/logo.png", "/tmp"),
    ).toBe(false);
  });

  it("does NOT match .png in prose without a real file", () => {
    expect(
      referencesImageFiles("I converted the PNG data to base64", "/tmp"),
    ).toBe(false);
  });

  it("does NOT match non-image extensions", () => {
    expect(referencesImageFiles("read src/index.ts", "/tmp")).toBe(false);
  });

  it("does NOT match empty string", () => {
    expect(referencesImageFiles("", "/tmp")).toBe(false);
  });

  it("does NOT match .json or .md paths", () => {
    expect(referencesImageFiles("read package.json", "/tmp")).toBe(false);
    expect(referencesImageFiles("read README.md", "/tmp")).toBe(false);
  });

  it("does NOT match svg or bmp extensions", () => {
    expect(referencesImageFiles("the logo is at assets/logo.svg", "/tmp")).toBe(
      false,
    );
    expect(
      referencesImageFiles("the bitmap is at assets/image.bmp", "/tmp"),
    ).toBe(false);
  });

  it("does NOT match text without file refs", () => {
    expect(referencesImageFiles("just some text", "/tmp")).toBe(false);
  });

  it("handles .webp extension", () => {
    const webpSig = Buffer.from("RIFFxxxxWEBP", "ascii");
    const path = makeTemp("diagram.webp", webpSig);
    expect(referencesImageFiles(`check ${path}`, "/tmp")).toBe(true);
  });

  it("handles .gif extension", () => {
    const gifSig = Buffer.from("GIF89a", "ascii");
    const path = makeTemp("demo.gif", gifSig);
    expect(referencesImageFiles(`look at ${path}`, "/tmp")).toBe(true);
  });

  it("handles .jpeg extension", () => {
    const jpgSig = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const path = makeTemp("photo.jpeg", jpgSig);
    expect(referencesImageFiles(`check ${path}`, "/tmp")).toBe(true);
  });

  it("does not match .png inside a curl URL that happens to include a local path", () => {
    expect(
      referencesImageFiles(
        `curl 'https://code.378labs.dev/user/repo/actions/runs/2/jobs/0/attempt/1/logs' -H 'Accept: text/html' && curl 'https://code.378labs.dev/assets/logo.png'`,
        "/tmp",
      ),
    ).toBe(false);
  });
});

describe("detectSupportedImageMimeType", () => {
  it.each([
    {
      desc: "png",
      input: Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000049444154",
        "hex",
      ),
      expected: "image/png",
    },
    {
      desc: "jpeg",
      input: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      expected: "image/jpeg",
    },
    {
      desc: "gif",
      input: Buffer.from("GIF89a", "ascii"),
      expected: "image/gif",
    },
    {
      desc: "webp",
      input: Buffer.from("RIFFxxxxWEBP", "ascii"),
      expected: "image/webp",
    },
  ])("detects $desc", ({ input, expected }) => {
    expect(detectSupportedImageMimeType(input)).toBe(expected);
  });

  it("rejects h264 bytes mislabeled as png by extension", () => {
    const h264Bytes = Buffer.from([
      0x00, 0x00, 0x00, 0x01, 0x67, 0x64, 0x00, 0x2a,
    ]);

    expect(detectSupportedImageMimeType(h264Bytes)).toBeNull();
  });

  it("rejects invalid png signature without IHDR", () => {
    const invalidPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    expect(detectSupportedImageMimeType(invalidPng)).toBeNull();
  });
});
