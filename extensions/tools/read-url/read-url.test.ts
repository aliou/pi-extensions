import { readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { afterEach, assert, describe, expect, it, vi } from "vitest";
import { executeReadUrlRequest, guessImageExtension } from "./";
import type { ReadUrlHandler } from "./handlers";

function createHandler(markdown = "tweet markdown"): ReadUrlHandler {
  return {
    name: "twitter",
    matches: () => true,
    fetchData: async (url) => ({
      sourceUrl: url.toString(),
      markdown,
      statusCode: 200,
      statusText: "OK",
      images: [
        { sourceUrl: "https://img.example.com/1.jpg", label: "first" },
        { sourceUrl: "https://img.example.com/2.png", label: "second" },
      ],
    }),
  };
}

// Collect temp file paths for cleanup after each test.
const tempFilePaths: string[] = [];

afterEach(async () => {
  for (const tempFilePath of tempFilePaths) {
    await rm(dirname(tempFilePath), {
      recursive: true,
      force: true,
    });
  }
  tempFilePaths.length = 0;
});

describe("read_url", () => {
  it("writes full content to temp file and returns preview in content", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
    const markdown = lines.join("\n");

    const nativeRead = {
      execute: vi.fn().mockResolvedValue({
        content: [],
      }),
    };

    const result = await executeReadUrlRequest(
      "https://x.com/alice/status/1",
      undefined,
      [createHandler(markdown)],
      nativeRead,
    );

    assert(result.details, "details exist");
    assert(result.details.tempFilePath, "tempFilePath exists");
    tempFilePaths.push(result.details.tempFilePath);

    // The content should be a preview, not the full markdown.
    const textBlock = result.content.find((c) => c.type === "text");
    assert(textBlock?.type === "text", "textBlock is text type");
    const text = textBlock.text;
    // Should contain the first 10 lines.
    expect(text).toContain("Line 1");
    expect(text).toContain("Line 10");
    // Should NOT contain line 11+.
    expect(text).not.toContain("Line 11");
    // Should contain the temp file path hint.
    expect(text).toContain("more lines");
    expect(result.details.tempFilePath).toBeTruthy();
    expect(result.details.totalLines).toBe(20);

    // Verify the temp file actually contains the full content.
    const tempFileContent = await readFile(
      result.details.tempFilePath,
      "utf-8",
    );
    expect(tempFileContent).toBe(markdown);
  });

  it("returns full content when under preview threshold", async () => {
    const markdown = "short content";

    const nativeRead = {
      execute: vi.fn().mockResolvedValue({
        content: [],
      }),
    };

    const result = await executeReadUrlRequest(
      "https://x.com/alice/status/1",
      undefined,
      [createHandler(markdown)],
      nativeRead,
    );

    assert(result.details, "details exist");
    assert(result.details.tempFilePath, "tempFilePath exists");
    tempFilePaths.push(result.details.tempFilePath);

    const textBlock = result.content.find((c) => c.type === "text");
    assert(textBlock?.type === "text", "textBlock is text type");
    expect(textBlock.text).toBe("short content");
    expect(result.details.totalLines).toBe(1);
  });

  it("appends native read image content after preview", async () => {
    const nativeRead = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({
          content: [
            { type: "text", text: "Read image file [1-first.jpg]" },
            { type: "image", image: "img-1" },
          ],
        })
        .mockResolvedValueOnce({
          content: [
            { type: "text", text: "Read image file [2-second.png]" },
            { type: "image", image: "img-2" },
          ],
        }),
    };

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([4, 5, 6]), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );

    const result = await executeReadUrlRequest(
      "https://x.com/alice/status/1",
      undefined,
      [createHandler()],
      nativeRead,
      fetchImpl,
    );

    assert(result.details, "details exist");
    assert(result.details.tempFilePath, "tempFilePath exists");
    tempFilePaths.push(result.details.tempFilePath);

    // First content block is the preview text.
    const firstBlock = result.content[0];
    expect(firstBlock?.type).toBe("text");
    assert(firstBlock?.type === "text", "firstBlock is text type");
    expect(firstBlock.text).toContain("tweet markdown");
    // Image content blocks follow.
    expect(result.content).toContainEqual({
      type: "text",
      text: "Read image file [1-first.jpg]",
    });
    expect(result.content).toContainEqual({
      type: "image",
      image: "img-1",
    });
    expect(result.details).toMatchObject({
      handler: "twitter",
      imageCount: 2,
      attachedImageCount: 2,
      skippedImageCount: 0,
    });
    expect(nativeRead.execute).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("skips failed images without failing the whole tool", async () => {
    const nativeRead = {
      execute: vi.fn().mockResolvedValue({
        content: [
          { type: "text", text: "Read image file [second]" },
          { type: "image", image: "img-2" },
        ],
      }),
    };

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("nope", {
          status: 500,
          statusText: "Boom",
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([4, 5, 6]), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );

    const result = await executeReadUrlRequest(
      "https://x.com/alice/status/1",
      undefined,
      [createHandler("markdown only")],
      nativeRead,
      fetchImpl,
    );

    assert(result.details, "details exist");
    assert(result.details.tempFilePath, "tempFilePath exists");
    tempFilePaths.push(result.details.tempFilePath);

    const firstBlock = result.content[0];
    expect(firstBlock?.type).toBe("text");
    assert(firstBlock?.type === "text", "firstBlock is text type");
    expect(firstBlock.text).toContain("markdown only");
    expect(result.content).toContainEqual({
      type: "text",
      text: "Read image file [second]",
    });
    expect(result.details).toMatchObject({
      imageCount: 2,
      attachedImageCount: 1,
      skippedImageCount: 1,
      failed: false,
    });
    expect(nativeRead.execute).toHaveBeenCalledTimes(1);
  });

  it("guesses image extensions from content type and url", () => {
    expect(
      guessImageExtension("image/webp", "https://img.example.com/file"),
    ).toBe(".webp");
    expect(
      guessImageExtension(null, "https://img.example.com/file.jpeg?format=raw"),
    ).toBe(".jpeg");
    expect(guessImageExtension(null, "not-a-url")).toBe(".img");
  });
});
