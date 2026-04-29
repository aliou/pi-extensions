import type {
  AgentToolResult,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme, type Theme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { isNotNil } from "../../utils";
import type { SubagentDetails } from "../types";
import { renderThinking, renderToolCall } from "./activity";
import { formatCollapsedHint } from "./footer";
import { Separator } from "./separator";
import type { ToolRenderContext } from "./types";

export function renderSubagentResult(
  result: AgentToolResult<unknown>,
  options: ToolRenderResultOptions,
  theme: Theme,
  _ctx: ToolRenderContext,
) {
  const container = new Container();
  container.addChild(new Spacer(1));

  const details = result.details as SubagentDetails | undefined;
  if (!details) {
    const text = result.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");
    container.addChild(
      new Text(theme.fg("muted", text || "Starting..."), 0, 0),
    );
    return container;
  }

  if (details.status === "running" || options.isPartial) {
    container.addChild(renderRunning(details, options, theme));
  }

  container.addChild(renderFinished(details, options, theme));
  return container;
}

function renderRunning(
  details: SubagentDetails,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  if (!options.expanded) {
    const running = details.toolCalls.filter(
      (toolCall) => toolCall.status === "running",
    ).length;
    const failed = details.toolCalls.filter(
      (toolCall) => toolCall.status === "error",
    ).length;

    const total = details.toolCalls.length;

    const result = [
      running
        ? `${theme.fg("success", running.toString())} running`
        : undefined,
      failed ? `${theme.fg("error", failed.toString())} failed` : undefined,
      total ? `${details.toolCalls.length} total` : undefined,
    ]
      .filter(isNotNil)
      .join(", ");

    return new Text(result, 0, 0);
  }

  const activity = renderActivity(details, theme);

  if (!activity) {
    return new Text(
      theme.fg("muted", "Waiting for subagent activity..."),
      0,
      0,
    );
  }

  return activity;
}

function renderActivity(details: SubagentDetails, theme: Theme) {
  const toolCallsById = new Map(
    details.toolCalls.map((toolCall) => [toolCall.toolCallId, toolCall]),
  );
  const container = new Container();
  let renderedCount = 0;

  for (const item of details.activity) {
    switch (item.type) {
      case "thinking":
        container.addChild(
          renderThinking(item.endedAt === null, item.content, theme),
        );
        renderedCount += 1;
        break;
      case "tool_call": {
        const toolCall = toolCallsById.get(item.toolCallId);
        if (!toolCall) break;

        container.addChild(renderToolCall(toolCall, theme));
        renderedCount += 1;
        break;
      }
      default:
        throw new Error(`Unknown activity type: ${item}`);
    }
  }

  if (renderedCount === 0) {
    return undefined;
  }

  return container;
}

function renderFinished(
  details: SubagentDetails,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  const text = details.response ?? details.error ?? "";

  const container = new Container();
  const activity = options.expanded
    ? renderActivity(details, theme)
    : undefined;
  if (activity) {
    container.addChild(activity);
    container.addChild(new Separator(theme));
  }

  container.addChild(new Markdown(text, 0, 0, getMarkdownTheme()));
  container.addChild(new Spacer(1));
  container.addChild(new Text(formatCollapsedHint(details, options), 0, 0));
  return container;
}
