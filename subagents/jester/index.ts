/**
 * Jester subagent - generates random, creative, and unexpected content. No tools.
 */

import {
  createRenderCache,
  MarkdownResponse,
  renderToolTextFallback,
  SubagentFooter,
  ToolCallHeader,
  ToolDetails,
  type ToolDetailsField,
} from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
  Theme,
  ToolDefinition,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { isDebugEnabled } from "@subagents/config";
import { JESTER_SYSTEM_PROMPT } from "@subagents/jester/system-prompt";
import type { JesterDetails, JesterInput } from "@subagents/jester/types";
import {
  executeSubagent,
  shouldFailToolCallForModelIssue,
} from "@subagents/lib";
import { selectModelForSubagent } from "@subagents/lib/subagent-model-selection";
import type { SubagentToolCall } from "@subagents/lib/types";

export const JESTER_GUIDANCE = `
## Jester

Use jester when you need to generate random data, creative content, or unexpected outputs.

**When to use:**
- Generating lists of random names, sentences, or text
- Creating placeholder data or test fixtures
- Brainstorming unusual ideas
- Producing varied, creative content

**When NOT to use:**
- Anything requiring web research, up-to-date facts, or codebase inspection
- Deterministic or factual outputs

**Input:**
- \`question\`: description of what random data to generate
`;

const parameters = Type.Object({
  question: Type.String({
    description: "Description of what random data to generate (no tools)",
  }),
});

export function createJesterTool(): ToolDefinition<
  typeof parameters,
  JesterDetails
> {
  // Render cache for reusing components across updates
  const renderCache = createRenderCache<
    string,
    {
      toolDetails: ToolDetails;
      footer: SubagentFooter;
      markdownResponse: MarkdownResponse | null;
    }
  >();

  return {
    name: "subagent.jester",
    label: "Jester",
    description:
      "Generate random, creative, and unexpected content. No tools, no browsing, no files.",
    promptSnippet: "Generate random or creative content.",
    promptGuidelines: [
      "Use this tool for random data, placeholder text, brainstorming, or other creative outputs.",
      "Do not use it for factual answers, web research, or codebase inspection.",
    ],
    parameters,

    async execute(
      toolCallId: string,
      args: JesterInput,
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<JesterDetails> | undefined,
      ctx: ExtensionContext,
    ): Promise<AgentToolResult<JesterDetails>> {
      const { question } = args;

      let resolvedModel: { provider: string; id: string } | undefined;

      const toolCalls: SubagentToolCall[] = [];

      try {
        const model = selectModelForSubagent("jester", ctx);
        resolvedModel = { provider: model.provider, id: model.id };

        // Publish resolved provider/model as early as possible for footer rendering.
        onUpdate?.({
          content: [{ type: "text", text: "" }],
          details: {
            _renderKey: toolCallId,
            question,
            toolCalls,
            resolvedModel,
          },
        });

        // Note: Temperature/topK are not yet exposed through createAgentSession API.
        // To maximize randomness, we rely on prompt engineering and model selection.
        // Using Haiku for speed; randomness comes from varied system instructions.
        const userMessage = question;

        const result = await executeSubagent(
          {
            name: "subagent.jester",
            model,
            systemPrompt: JESTER_SYSTEM_PROMPT,
            tools: [],
            customTools: [],
            thinkingLevel: "off",
            logging: {
              enabled: true,
              debug: isDebugEnabled(),
            },
          },
          userMessage,
          ctx,
          (_delta, accumulated) => {
            onUpdate?.({
              content: [{ type: "text", text: accumulated }],
              details: {
                _renderKey: toolCallId,
                question,
                toolCalls,
                response: accumulated,
                resolvedModel,
              },
            });
          },
          signal,
        );

        if (result.aborted) {
          return {
            content: [{ type: "text" as const, text: "Aborted" }],
            details: {
              _renderKey: toolCallId,
              question,
              toolCalls,
              aborted: true,
              usage: result.usage,
              resolvedModel,
            },
          };
        }

        if (result.error) {
          if (shouldFailToolCallForModelIssue(result)) {
            throw new Error(result.error);
          }

          return {
            content: [
              { type: "text" as const, text: `Error: ${result.error}` },
            ],
            details: {
              _renderKey: toolCallId,
              question,
              toolCalls,
              error: result.error,
              usage: result.usage,
              resolvedModel,
            },
          };
        }

        return {
          content: [{ type: "text" as const, text: result.content }],
          details: {
            _renderKey: toolCallId,
            question,
            toolCalls,
            response: result.content,
            usage: result.usage,
            resolvedModel,
          },
        };
      } catch (err) {
        const error =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : JSON.stringify(err);

        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          details: {
            _renderKey: toolCallId,
            question,
            toolCalls,
            error,
            resolvedModel,
          },
        };
      }
    },

    renderCall(args, theme) {
      const question = args.question?.trim() ?? "";

      return new ToolCallHeader(
        {
          toolName: "Jester",
          mainArg: question,
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<JesterDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const { details } = result;

      if (!details) {
        return renderToolTextFallback(result, theme);
      }

      const {
        _renderKey,
        response,
        aborted,
        error,
        usage,
        toolCalls,
        resolvedModel,
      } = details;

      const renderKey = _renderKey ?? "_default_";
      const cached = renderCache.get(renderKey);

      // Footer - reuse or create
      const footerData = { resolvedModel, usage, toolCalls };
      let footer: SubagentFooter;
      if (cached) {
        footer = cached.footer;
        footer.updateData(footerData);
      } else {
        footer = new SubagentFooter(theme, footerData);
      }

      // MarkdownResponse - reuse or create
      let mdResponse = cached?.markdownResponse ?? null;

      // Build fields based on state
      const fields: ToolDetailsField[] = [];

      if (aborted) {
        fields.push({ label: "Status", value: "Aborted" });
      } else if (error) {
        fields.push({ label: "Error", value: error });
      } else if (response) {
        if (mdResponse) {
          mdResponse.setContent(response);
        } else {
          mdResponse = new MarkdownResponse(response, theme);
        }
        fields.push(mdResponse);
      }

      // ToolDetails - reuse or create
      let toolDetails: ToolDetails;
      if (cached) {
        toolDetails = cached.toolDetails;
        toolDetails.update({ fields, footer }, options);
      } else {
        toolDetails = new ToolDetails({ fields, footer }, options, theme);
      }

      // Update cache
      renderCache.set(renderKey, {
        toolDetails,
        footer,
        markdownResponse: mdResponse,
      });

      return toolDetails;
    },
  };
}

export async function executeJester(
  input: JesterInput,
  ctx: ExtensionContext,
  onUpdate?: AgentToolUpdateCallback<JesterDetails>,
  signal?: AbortSignal,
): Promise<AgentToolResult<JesterDetails>> {
  const tool = createJesterTool();
  return tool.execute("direct", input, signal, onUpdate, ctx);
}
