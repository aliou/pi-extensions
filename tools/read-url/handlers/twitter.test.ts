import { describe, expect, it } from "vitest";
import { renderTwitterPayload } from "./twitter";

describe("twitter read_url handler", () => {
  it("returns top-level tweet images and keeps markdown readable", async () => {
    const rendered = await renderTwitterPayload(
      {
        code: 200,
        tweet: {
          id_str: "100",
          raw_text: {
            text: "hello world",
            facets: [],
          },
          media: {
            all: [
              { url: "https://pbs.twimg.com/media/a.jpg" },
              { url: "https://pbs.twimg.com/media/b.png" },
            ],
          },
        },
      },
      undefined,
    );

    expect(rendered.markdown).toBe("hello world");
    expect(rendered.images).toEqual([
      {
        sourceUrl: "https://pbs.twimg.com/media/a.jpg",
        tweetId: "100",
        kind: "tweet_media",
        label: "tweet image",
      },
      {
        sourceUrl: "https://pbs.twimg.com/media/b.png",
        tweetId: "100",
        kind: "tweet_media",
        label: "tweet image",
      },
    ]);
  });

  it("collects article cover and inline images in stable order", async () => {
    const rendered = await renderTwitterPayload(
      {
        code: 200,
        tweet: {
          id_str: "200",
          article: {
            title: "Article title",
            cover_media: {
              media_info: {
                original_img_url: "https://img.example.com/cover.jpg",
              },
            },
            media_entities: [
              {
                media_id: "m-1",
                media_info: {
                  original_img_url: "https://img.example.com/inline-1.png",
                },
              },
              {
                media_id: "m-2",
                media_info: {
                  original_img_url: "https://img.example.com/inline-2.png",
                },
              },
            ],
            content: {
              entityMap: [
                {
                  value: {
                    type: "MEDIA",
                    data: { mediaItems: [{ mediaId: "m-1" }] },
                  },
                },
                {
                  value: {
                    type: "DIVIDER",
                  },
                },
                {
                  value: {
                    type: "MEDIA",
                    data: { mediaItems: [{ mediaId: "m-2" }] },
                  },
                },
              ],
              blocks: [
                {
                  type: "unstyled",
                  text: "Intro",
                  inlineStyleRanges: [],
                  entityRanges: [],
                },
                {
                  type: "atomic",
                  text: "",
                  inlineStyleRanges: [],
                  entityRanges: [{ key: 0 }],
                },
                {
                  type: "atomic",
                  text: "",
                  inlineStyleRanges: [],
                  entityRanges: [{ key: 1 }],
                },
                {
                  type: "unstyled",
                  text: "Body",
                  inlineStyleRanges: [],
                  entityRanges: [],
                },
                {
                  type: "atomic",
                  text: "",
                  inlineStyleRanges: [],
                  entityRanges: [{ key: 2 }],
                },
              ],
            },
          },
        },
      },
      undefined,
    );

    expect(rendered.markdown).toContain("# Article title");
    expect(rendered.markdown).toContain("Intro");
    expect(rendered.markdown).toContain("---");
    expect(rendered.markdown).toContain("Body");
    expect(rendered.images.map((image) => image.sourceUrl)).toEqual([
      "https://img.example.com/cover.jpg",
      "https://img.example.com/inline-1.png",
      "https://img.example.com/inline-2.png",
    ]);
    expect(rendered.images.map((image) => image.kind)).toEqual([
      "article_cover",
      "article_inline",
      "article_inline",
    ]);
  });

  it("collects quoted tweet images before top-level tweet media", async () => {
    const rendered = await renderTwitterPayload(
      {
        code: 200,
        tweet: {
          id_str: "300",
          raw_text: {
            text: "main tweet",
            facets: [],
          },
          quote: {
            url: "https://x.com/quote/status/301",
            created_at: "2026-03-31",
            author: {
              screen_name: "quote-user",
            },
          },
          media: {
            all: [{ url: "https://img.example.com/main.jpg" }],
          },
        },
      },
      undefined,
      {
        visitedStatusIds: new Set(["300"]),
        fetchPayload: async (statusId) => {
          expect(statusId).toBe("301");
          return {
            code: 200,
            tweet: {
              id_str: "301",
              raw_text: {
                text: "quoted tweet",
                facets: [],
              },
              author: {
                screen_name: "quote-user",
              },
              created_at: "2026-03-31",
              media: {
                all: [{ url: "https://img.example.com/quote.jpg" }],
              },
            },
          };
        },
      },
    );

    expect(rendered.markdown).toContain("main tweet");
    expect(rendered.markdown).toContain("> quoted tweet");
    expect(rendered.markdown).toContain(
      "[— @quote-user, 2026-03-31](https://x.com/quote/status/301)",
    );
    expect(rendered.images.map((image) => image.sourceUrl)).toEqual([
      "https://img.example.com/quote.jpg",
      "https://img.example.com/main.jpg",
    ]);
    expect(rendered.images.map((image) => image.kind)).toEqual([
      "quoted_tweet_media",
      "tweet_media",
    ]);
  });

  it("dedupes duplicate image URLs", async () => {
    const rendered = await renderTwitterPayload(
      {
        code: 200,
        tweet: {
          id_str: "400",
          article: {
            title: "Dupes",
            cover_media: {
              media_info: {
                original_img_url: "https://img.example.com/same.png",
              },
            },
            media_entities: [
              {
                media_id: "m-1",
                media_info: {
                  original_img_url: "https://img.example.com/same.png",
                },
              },
            ],
            content: {
              entityMap: [
                {
                  value: {
                    type: "MEDIA",
                    data: { mediaItems: [{ mediaId: "m-1" }] },
                  },
                },
              ],
              blocks: [
                {
                  type: "atomic",
                  text: "",
                  inlineStyleRanges: [],
                  entityRanges: [{ key: 0 }],
                },
              ],
            },
          },
        },
      },
      undefined,
    );

    expect(rendered.images).toHaveLength(1);
    expect(rendered.images[0]?.sourceUrl).toBe(
      "https://img.example.com/same.png",
    );
  });

  it("avoids infinite recursion on repeated quoted status ids", async () => {
    let fetchCount = 0;

    const rendered = await renderTwitterPayload(
      {
        code: 200,
        tweet: {
          id_str: "500",
          raw_text: {
            text: "outer",
            facets: [],
          },
          quote: {
            url: "https://x.com/reply/status/501",
          },
        },
      },
      undefined,
      {
        visitedStatusIds: new Set(["500"]),
        fetchPayload: async (statusId) => {
          fetchCount += 1;
          expect(statusId).toBe("501");
          return {
            code: 200,
            tweet: {
              id_str: "501",
              raw_text: {
                text: "inner",
                facets: [],
              },
              quote: {
                url: "https://x.com/reply/status/500",
              },
              media: {
                all: [{ url: "https://img.example.com/inner.png" }],
              },
            },
          };
        },
      },
    );

    expect(fetchCount).toBe(1);
    expect(rendered.markdown).toContain("outer");
    expect(rendered.markdown).toContain("> inner");
    expect(rendered.images.map((image) => image.sourceUrl)).toEqual([
      "https://img.example.com/inner.png",
    ]);
  });
});
