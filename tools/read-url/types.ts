import type { AgentToolResult } from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "typebox";

export const ReadUrlParams = Type.Object({
  url: Type.String({
    description: "URL to fetch as Markdown via markdown.new",
  }),
});

export type ReadUrlParamsType = Static<typeof ReadUrlParams>;

export interface NativeReadTool {
  execute(
    toolCallId: string,
    params: { path: string; offset?: number; limit?: number },
    signal?: AbortSignal,
    onUpdate?: unknown,
  ): Promise<AgentToolResult<unknown>>;
}

export type ReadContentBlock = ExecuteResult["content"][number];

export type FetchLike = typeof fetch;

export interface ReadUrlDetails {
  url: string;
  sourceUrl: string;
  title?: string;
  handler: string;
  statusCode?: number;
  statusText?: string;
  failed: boolean;
  imageCount?: number;
  attachedImageCount?: number;
  skippedImageCount?: number;
  tempFilePath?: string;
  totalLines?: number;
}

export type ExecuteResult = AgentToolResult<ReadUrlDetails>;

export const COLLAPSED_PREVIEW_LINES = 8;
