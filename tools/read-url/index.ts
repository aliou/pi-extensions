import type {
  AgentToolResult,
  ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { createReadTool, defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { executeReadUrlRequest } from "./fetch";
import {
  createGistHandler,
  createGitHubHandler,
  createMarkdownNewHandler,
  createTailscaleHandler,
  createTwitterHandler,
  type ReadUrlHandler,
} from "./handlers";
import { renderCall, renderResult } from "./render";
import type { ReadUrlDetails } from "./types";

const ReadUrlParams = Type.Object({
  url: Type.String({
    description: "URL to fetch as Markdown via markdown.new",
  }),
});

function createReadUrlTool(_pi: ExtensionAPI) {
  const handlers: ReadUrlHandler[] = [
    createTwitterHandler(),
    createGitHubHandler(),
    createGistHandler(),
    createTailscaleHandler(),
    createMarkdownNewHandler(),
  ];
  const nativeRead = createReadTool(process.cwd());

  return defineTool({
    name: "read_url",
    label: "Read URL",
    description:
      "Fetch a URL as Markdown via handlers with markdown.new fallback.",
    parameters: ReadUrlParams,

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      return executeReadUrlRequest(
        params.url,
        signal,
        handlers,
        nativeRead,
        fetch,
      );
    },

    renderCall(args, theme) {
      return renderCall(args, theme);
    },
    renderResult(result, options, theme) {
      return renderResult(
        result as AgentToolResult<ReadUrlDetails>,
        options,
        theme,
      );
    },
  });
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createReadUrlTool(pi));
}
