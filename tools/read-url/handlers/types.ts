export interface HandlerImage {
  sourceUrl: string;
  label?: string;
  tweetId?: string;
  kind?:
    | "tweet_media"
    | "article_cover"
    | "article_inline"
    | "quoted_tweet_media";
}

export interface HandlerData {
  sourceUrl: string;
  title?: string;
  markdown: string;
  statusCode?: number;
  statusText?: string;
  images?: HandlerImage[];
}

export interface ReadUrlHandler {
  name: string;
  matches(url: URL): boolean;
  fetchData(url: URL, signal: AbortSignal | undefined): Promise<HandlerData>;
}
