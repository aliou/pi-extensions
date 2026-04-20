import type { HandlerData, HandlerImage, ReadUrlHandler } from "./types";

function createTimeoutSignal(
  timeoutMs: number,
  signal?: AbortSignal,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeoutSignal;
  return AbortSignal.any([signal, timeoutSignal]);
}

type UnknownRecord = Record<string, unknown>;

interface FxTwitterApiResponse {
  code?: number;
  message?: string;
  tweet?: UnknownRecord;
}

interface RenderTwitterPayloadOptions {
  visitedStatusIds?: Set<string>;
  fetchPayload?: (
    statusId: string,
    signal: AbortSignal | undefined,
  ) => Promise<FxTwitterApiResponse>;
}

interface RenderTwitterPayloadResult {
  markdown: string;
  images: HandlerImage[];
}

export function createTwitterHandler(): ReadUrlHandler {
  return {
    name: "twitter",
    matches(url: URL): boolean {
      const host = normalizeHost(url.hostname);
      const isTwitterHost =
        host === "x.com" ||
        host === "twitter.com" ||
        host === "mobile.x.com" ||
        host === "mobile.twitter.com";
      return isTwitterHost && /\/status\/\d+/.test(url.pathname);
    },
    async fetchData(
      url: URL,
      signal: AbortSignal | undefined,
    ): Promise<HandlerData> {
      const statusId = extractStatusId(url.toString());
      const visitedStatusIds = new Set<string>([statusId]);
      const payload = await fetchTwitterPayload(statusId, signal);

      const rendered = await renderTwitterPayload(payload, signal, {
        visitedStatusIds,
        fetchPayload: fetchTwitterPayload,
      });

      const articleTitle = asString(getPath(payload.tweet, "article", "title"));
      const authorName = asString(
        getPath(payload.tweet, "author", "screen_name"),
      );
      const title =
        articleTitle ??
        (authorName ? `Post by @${authorName}` : `Post ${statusId}`);

      return {
        sourceUrl: url.toString(),
        title,
        markdown: rendered.markdown,
        images: rendered.images,
        statusCode: 200,
        statusText: "OK",
      };
    },
  };
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function extractStatusId(url: string): string {
  const match = url.match(/\/status\/(\d+)/);
  if (!match?.[1]) {
    throw new Error(`Could not extract status ID from URL: ${url}`);
  }
  return match[1];
}

async function fetchTwitterPayload(
  statusId: string,
  signal: AbortSignal | undefined,
): Promise<FxTwitterApiResponse> {
  const apiUrl = `https://api.fxtwitter.com/status/${statusId}`;
  const response = await fetch(apiUrl, {
    signal: createTimeoutSignal(5000, signal),
  });
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText || "Error"}${bodyText ? ` - ${bodyText}` : ""}`,
    );
  }

  let payload: FxTwitterApiResponse;
  try {
    payload = JSON.parse(bodyText) as FxTwitterApiResponse;
  } catch {
    throw new Error("Invalid JSON response from fxtwitter API");
  }

  if (payload.code !== 200 || !payload.tweet) {
    throw new Error(
      `fxtwitter API failed: code=${payload.code ?? "missing"} message=${payload.message ?? "unknown"}`,
    );
  }

  return payload;
}

export async function renderTwitterPayload(
  payload: FxTwitterApiResponse,
  signal: AbortSignal | undefined,
  options: RenderTwitterPayloadOptions = {},
): Promise<RenderTwitterPayloadResult> {
  const markdown: string[] = [];
  const images: HandlerImage[] = [];
  const seenImages = new Set<string>();
  const visitedStatusIds = options.visitedStatusIds ?? new Set<string>();
  const fetchPayload = options.fetchPayload ?? fetchTwitterPayload;

  const push = (line = "") => {
    markdown.push(line);
  };

  const addImage = (image: HandlerImage) => {
    const normalizedUrl = normalizeImageUrl(image.sourceUrl);
    if (!normalizedUrl || seenImages.has(normalizedUrl)) return;
    seenImages.add(normalizedUrl);
    images.push({ ...image, sourceUrl: normalizedUrl });
  };

  const addImages = (items: HandlerImage[]) => {
    for (const item of items) {
      addImage(item);
    }
  };

  const article = asRecord(getPath(payload.tweet, "article"));
  const currentTweetId =
    asString(getPath(payload.tweet, "id_str")) ??
    asString(getPath(payload.tweet, "id"));

  if (article) {
    push(`# ${asString(article.title) ?? "Untitled"}`);
    push("");

    const coverUrl = asString(
      getPath(article, "cover_media", "media_info", "original_img_url"),
    );
    if (coverUrl) {
      addImage({
        sourceUrl: coverUrl,
        tweetId: currentTweetId,
        kind: "article_cover",
        label: "cover image",
      });
    }

    const entityMap = toArray(getPath(article, "content", "entityMap"));
    const mediaEntities = toArray(getPath(article, "media_entities"));
    const blocks = toArray(getPath(article, "content", "blocks"));

    for (const block of blocks) {
      const rendered = renderArticleBlock(block, entityMap);
      if (rendered) {
        push(rendered);
        push("");
      }

      const entityRanges = toArray(getPath(block, "entityRanges"));
      const blockType = asString(getPath(block, "type"));

      for (const range of entityRanges) {
        const key = asNumber(getPath(range, "key"));
        if (key === undefined) continue;

        const entity = asRecord(getPath(entityMap[key], "value"));
        const entityType = asString(entity?.type);

        if (entityType === "MEDIA") {
          const mediaItems = toArray(getPath(entity, "data", "mediaItems"));
          const mediaId = getPath(mediaItems[0], "mediaId");
          const media = mediaEntities.find(
            (item) => getPath(item, "media_id") === mediaId,
          );
          const mediaUrl = asString(
            getPath(media, "media_info", "original_img_url"),
          );
          if (mediaUrl) {
            addImage({
              sourceUrl: mediaUrl,
              tweetId: currentTweetId,
              kind: "article_inline",
              label: "inline image",
            });
          }
        } else if (entityType === "DIVIDER" && blockType === "atomic") {
          push("---");
          push("");
        } else if (entityType === "TWEET" && blockType === "atomic") {
          push("> Embedded tweet");
          push("");
        }
      }
    }
  } else {
    const text = renderTweetText(payload.tweet);
    if (text) {
      push(text);
      push("");
    }

    const quote = asRecord(getPath(payload.tweet, "quote"));
    const quoteUrl = asString(quote?.url);

    if (quoteUrl?.includes("/status/")) {
      const quoteStatusId = extractStatusId(quoteUrl);
      if (!visitedStatusIds.has(quoteStatusId)) {
        visitedStatusIds.add(quoteStatusId);

        const quotePayload = await fetchPayload(quoteStatusId, signal);
        const quoteRendered = await renderTwitterPayload(quotePayload, signal, {
          visitedStatusIds,
          fetchPayload,
        });

        if (quoteRendered.markdown.trim()) {
          push(...blockquoteLines(quoteRendered.markdown.trimEnd()));
          push("");
        }

        addImages(
          quoteRendered.images.map((image) => ({
            ...image,
            kind: "quoted_tweet_media",
          })),
        );

        const quoteUsername =
          asString(getPath(quotePayload.tweet, "author", "screen_name")) ??
          asString(getPath(quote, "author", "screen_name")) ??
          "unknown";
        const quoteDatetime =
          asString(getPath(quotePayload.tweet, "created_at")) ??
          asString(getPath(quote, "created_at")) ??
          asString(getPath(quotePayload.tweet, "created_timestamp")) ??
          "unknown date";

        push(`[— @${quoteUsername}, ${quoteDatetime}](${quoteUrl})`);
        push("");
      }
    }

    const mediaItems = toArray(getPath(payload.tweet, "media", "all"));
    for (const item of mediaItems) {
      const mediaUrl = asString(getPath(item, "url"));
      if (!mediaUrl) continue;
      addImage({
        sourceUrl: mediaUrl,
        tweetId: currentTweetId,
        kind: "tweet_media",
        label: "tweet image",
      });
    }
  }

  return {
    markdown: normalizeMarkdownOutput(markdown.join("\n")),
    images,
  };
}

type Marker = {
  open: string;
  close: string;
  order: number;
};

function normalizeMarkdownOutput(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeHeadingText(text: string): string {
  return text
    .replace(/^\*\*(.+?)\*\*(?=\S)/, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeImageUrl(url: string): string | null {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function renderArticleBlock(block: unknown, entityMap: unknown[]): string {
  const type = asString(getPath(block, "type"));
  const text = asString(getPath(block, "text")) ?? "";
  const inlineStyleRanges = toArray(getPath(block, "inlineStyleRanges"));
  const entityRanges = toArray(getPath(block, "entityRanges"));

  const formatted = applyMarkdownFormatting(
    text,
    inlineStyleRanges,
    entityRanges,
    entityMap,
  );

  switch (type) {
    case "unstyled":
      return formatted;
    case "unordered-list-item":
      return `- ${formatted}`;
    case "ordered-list-item":
      return `1. ${formatted}`;
    case "header-one":
      return `# ${normalizeHeadingText(formatted)}`;
    case "header-two":
      return `## ${normalizeHeadingText(formatted)}`;
    case "header-three":
      return `### ${normalizeHeadingText(formatted)}`;
    case "blockquote":
      return formatted
        .split("\n")
        .map((line: string) => `> ${line}`)
        .join("\n");
    case "atomic":
      return "";
    default:
      return formatted;
  }
}

function applyMarkdownFormatting(
  text: string,
  inlineStyleRanges: unknown[],
  entityRanges: unknown[],
  entityMap: unknown[],
): string {
  if (!text) return "";

  // fxtwitter ranges appear to be based on Unicode code points (not UTF-16 code units).
  // Use Array.from() to avoid splitting surrogate pairs (emoji) during marker insertion.
  const chars = Array.from(text);

  const starts = new Map<number, Marker[]>();
  const ends = new Map<number, Marker[]>();

  const addMarker = (offset: number, length: number, marker: Marker) => {
    if (length <= 0) return;
    const end = offset + length;
    if (!starts.has(offset)) starts.set(offset, []);
    if (!ends.has(end)) ends.set(end, []);
    starts.get(offset)?.push(marker);
    ends.get(end)?.push(marker);
  };

  for (const range of inlineStyleRanges) {
    const style = asString(getPath(range, "style"));
    const offset = asNumber(getPath(range, "offset"));
    const length = asNumber(getPath(range, "length"));
    if (offset === undefined || length === undefined) continue;

    if (style === "Bold") {
      addMarker(offset, length, {
        open: "**",
        close: "**",
        order: 20,
      });
    } else if (style === "Italic") {
      addMarker(offset, length, {
        open: "*",
        close: "*",
        order: 10,
      });
    }
  }

  for (const range of entityRanges) {
    const key = asNumber(getPath(range, "key"));
    const offset = asNumber(getPath(range, "offset"));
    const length = asNumber(getPath(range, "length"));
    if (key === undefined || offset === undefined || length === undefined)
      continue;

    const entity = asRecord(getPath(entityMap[key], "value"));
    if (asString(entity?.type) === "LINK") {
      const href = asString(getPath(entity, "data", "url"));
      if (href) {
        addMarker(offset, length, {
          open: "[",
          close: `](${href})`,
          order: 100,
        });
      }
    }
  }

  let out = "";
  for (let i = 0; i <= chars.length; i += 1) {
    const closing = ends.get(i) ?? [];
    closing.sort((a, b) => a.order - b.order);
    for (const marker of closing) out += marker.close;

    if (i === chars.length) break;

    const opening = starts.get(i) ?? [];
    opening.sort((a, b) => b.order - a.order);
    for (const marker of opening) out += marker.open;

    out += chars[i];
  }

  return out;
}

function renderTweetText(tweet: unknown): string {
  const raw = asRecord(getPath(tweet, "raw_text"));
  const rawText = asString(raw?.text);

  if (!rawText) {
    return asString(getPath(tweet, "text")) ?? "";
  }

  const chars = Array.from(rawText);
  const facets = toArray(raw?.facets).sort(
    (a: unknown, b: unknown) => getFacetStart(a) - getFacetStart(b),
  );

  let out = "";
  let cursor = 0;

  for (const facet of facets) {
    const indices = toArray(getPath(facet, "indices"));
    const start = asNumber(indices[0]);
    const end = asNumber(indices[1]);

    if (start === undefined || end === undefined) continue;
    if (start < cursor) continue;

    out += chars.slice(cursor, start).join("");
    out += renderTweetFacet(chars.slice(start, end).join(""), facet);
    cursor = end;
  }

  out += chars.slice(cursor).join("");
  return cleanupTweetMarkdown(out);
}

function getFacetStart(facet: unknown): number {
  const indices = toArray(getPath(facet, "indices"));
  return asNumber(indices[0]) ?? Number.MAX_SAFE_INTEGER;
}

function renderTweetFacet(text: string, facet: unknown): string {
  const facetType = asString(getPath(facet, "type"));

  switch (facetType) {
    case "mention": {
      const username = String(getPath(facet, "original") ?? text).replace(
        /^@/,
        "",
      );
      return `[@${username}](https://x.com/${username})`;
    }
    case "media":
      return "";
    case "link":
    case "url": {
      const href = resolveFacetUrl(facet);
      if (!href) return text;
      const label = resolveFacetLabel(facet, href);
      return `[${label}](${href})`;
    }
    default:
      return text;
  }
}

function resolveFacetLabel(facet: unknown, href: string): string {
  const display = asString(getPath(facet, "display"));

  if (display && !isPicXUrl(display)) {
    return display;
  }

  return href;
}

function resolveFacetUrl(facet: unknown): string | null {
  const candidates = [
    asString(getPath(facet, "unwound_url")),
    asString(getPath(facet, "expanded_url")),
    asString(getPath(facet, "expanded")),
    asString(getPath(facet, "url")),
    asString(getPath(facet, "destination")),
    asString(getPath(facet, "target")),
    asString(getPath(facet, "replacement")),
    asString(getPath(facet, "original")),
  ].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  for (const candidate of candidates) {
    if (
      isInternalXUrl(candidate) ||
      isTcoUrl(candidate) ||
      isPicXUrl(candidate)
    ) {
      continue;
    }
    return candidate;
  }

  return null;
}

function isInternalXUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "x.com" && host !== "twitter.com") return false;
    return parsed.pathname.startsWith("/i/");
  } catch {
    return false;
  }
}

function isTcoUrl(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === "t.co";
  } catch {
    return false;
  }
}

function isPicXUrl(url: string): boolean {
  return /^pic\.x\.com\//.test(url) || /^https?:\/\/pic\.x\.com\//.test(url);
}

function cleanupTweetMarkdown(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function blockquoteLines(text: string): string[] {
  return text.split("\n").map((line) => (line.length > 0 ? `> ${line}` : ">"));
}

function asRecord(value: unknown): UnknownRecord | undefined {
  if (value && typeof value === "object") {
    return value as UnknownRecord;
  }
  return undefined;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getPath(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;
  for (const key of keys) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}
