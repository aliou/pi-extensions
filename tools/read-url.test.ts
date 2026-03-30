import { describe, expect, it, vi } from "vitest";
import { executeReadUrlRequest, guessImageExtension } from "./read-url";
import type { ReadUrlHandler } from "./read-url/handlers";

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

describe("read_url", () => {
  it("appends native read image content after markdown", async () => {
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

    expect(result.content).toEqual([
      { type: "text", text: "tweet markdown" },
      { type: "text", text: "Read image file [1-first.jpg]" },
      { type: "image", image: "img-1" },
      { type: "text", text: "Read image file [2-second.png]" },
      { type: "image", image: "img-2" },
    ]);
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

    expect(result.content).toEqual([
      { type: "text", text: "markdown only" },
      { type: "text", text: "Read image file [second]" },
      { type: "image", image: "img-2" },
    ]);
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
