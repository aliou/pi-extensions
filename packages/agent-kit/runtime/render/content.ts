import type {
  AgentToolResult,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme, type Theme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import type { SubagentConfig } from "../../types";
import type { SubagentDetails, SubagentToolCall } from "../types";
import { renderThinking, renderToolCall } from "./activity";
import { formatCollapsedHint } from "./footer";
import { Separator } from "./separator";
import type { ToolRenderContext } from "./types";

export function renderSubagentResult(
  config: SubagentConfig,
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
    container.addChild(renderRunning(config, details, options, theme));
  } else {
    container.addChild(renderFinished(config, details, options, theme));
  }

  container.addChild(new Spacer(1));
  container.addChild(new Text(formatCollapsedHint(details, options), 0, 0));

  return container;
}

function renderRunning(
  config: SubagentConfig,
  details: SubagentDetails,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  const container = new Container();

  if (!options.expanded) {
    const recentToolCalls = details.toolCalls.slice(-3);

    if (recentToolCalls.length === 0) {
      container.addChild(
        new Text(theme.fg("muted", "Waiting for subagent activity..."), 0, 0),
      );
    } else {
      for (const toolCall of recentToolCalls) {
        container.addChild(
          renderConfiguredToolCall(config, toolCall, options, theme),
        );
      }
    }
  } else {
    const activity = renderActivity(config, details, options, theme);

    if (!activity) {
      container.addChild(
        new Text(theme.fg("muted", "Waiting for subagent activity..."), 0, 0),
      );
    } else {
      container.addChild(activity);
    }
  }

  return container;
}

function renderActivity(
  config: SubagentConfig,
  details: SubagentDetails,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
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

        container.addChild(
          renderConfiguredToolCall(config, toolCall, options, theme),
        );
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
  config: SubagentConfig,
  details: SubagentDetails,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  const text = details.response ?? details.error ?? "";

  const container = new Container();
  const activity = options.expanded
    ? renderActivity(config, details, options, theme)
    : undefined;
  if (activity) {
    container.addChild(activity);
    container.addChild(new Separator(theme));
  }

  container.addChild(new Markdown(text, 0, 0, getMarkdownTheme()));
  return container;
}

function renderConfiguredToolCall(
  config: SubagentConfig,
  toolCall: SubagentToolCall,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  const renderer = config.tools.find(
    (tool) => tool.name === toolCall.toolName,
  )?.render;

  return (
    renderer?.(toolCall, options, theme) ?? renderToolCall(toolCall, theme)
  );
}
