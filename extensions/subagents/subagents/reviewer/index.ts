/**
 * Reviewer subagent - code review feedback on diffs.
 */

import {
  createRenderCache,
  FailedToolCalls,
  MarkdownResponse,
  renderToolTextFallback,
  SubagentFooter,
  ToolCallHeader,
  ToolCallList,
  ToolCallSummary,
  ToolDetails,
  type ToolDetailsField,
} from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
  Skill,
  ToolDefinition,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import {
  createBashTool,
  createReadOnlyTools,
  type Theme,
} from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { isDebugEnabled } from "../../config";
import {
  executeSubagent,
  resolveSkillsByName,
  shouldFailToolCallForModelIssue,
} from "../../lib";
import { selectModelForSubagent } from "../../lib/subagent-model-selection";
import type { SubagentToolCall } from "../../lib/types";
import { REVIEWER_SYSTEM_PROMPT } from "./system-prompt";
import { createReviewerToolFormatter } from "./tool-formatter";
import { createReviewerTools } from "./tools";
import type { ReviewerDetails, ReviewerInput } from "./types";

/** System prompt guidance for reviewer tool usage */
export const REVIEWER_GUIDANCE = `
## Reviewer

Use reviewer for fast, high-signal code review feedback on diffs. It acts like a senior reviewer: calls out risks, correctness issues, test gaps, and maintainability concerns.

**Inputs:**
- \`diff\`: Freeform description of what to review (e.g., "staged changes", "last commit", "changes in src/auth/")
- \`focus\`: Optional focus area (security, performance, style, general)
- \`context\`: Optional description of the change intent

**Behavior:**
- Parse \`diff\` to determine the right git diff command
- Only flag issues introduced in the diff
- Avoid nitpicks unless style-only feedback requested

**Output format:**
Summary, Findings with [P0-P3], Verdict.
`;

const parameters = Type.Object({
  diff: Type.String({
    description:
      "Freeform description of what to review (e.g., staged changes, last commit, changes in src/auth/)",
  }),
  focus: Type.Optional(
    Type.String({
      description: "Focus area: security, performance, style, or general",
    }),
  ),
  context: Type.Optional(
    Type.String({
      description: "What the change is trying to achieve",
    }),
  ),
  skills: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Skill names to provide specialized context (e.g., 'ios-26', 'drizzle-orm')",
    }),
  ),
});

/** Build the user message for the subagent based on inputs */
function buildUserMessage(input: ReviewerInput): string {
  const parts: string[] = [];

  parts.push(`Diff scope: ${input.diff}`);

  if (input.focus) {
    parts.push(`Focus: ${input.focus}`);
  }

  if (input.context) {
    parts.push(`Context: ${input.context}`);
  }

  return parts.join("\n");
}

/** Create the reviewer tool definition for use in extensions */
export function createReviewerTool(): ToolDefinition<
  typeof parameters,
  ReviewerDetails
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
    name: "reviewer",
    label: "Reviewer",
    description: `Code review agent that analyzes diffs and returns structured feedback.

Inputs:
- diff: Freeform description of what to review (e.g., staged changes, last commit, changes in src/auth/)
- focus: Optional focus area (security, performance, style, general)
- context: Optional description of the change intent

Pass relevant skills (e.g., 'ios-26', 'drizzle-orm') to provide specialized context for the task.`,
    promptSnippet:
      "Review a diff or change set for correctness, risks, and test gaps.",
    promptGuidelines: [
      "Use this tool for fast review of diffs, staged changes, or recent commits.",
      "Prefer it when the user wants risks, correctness issues, test gaps, or a verdict on a change.",
      "Focus on issues introduced by the diff, not unrelated code.",
    ],

    parameters,

    async execute(
      toolCallId: string,
      args: ReviewerInput,
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<ReviewerDetails> | undefined,
      ctx: ExtensionContext,
    ) {
      const { diff, focus, context, skills: skillNames } = args;

      // Resolve skills if provided
      let resolvedSkills: Skill[] = [];
      let notFoundSkills: string[] = [];

      if (skillNames && skillNames.length > 0) {
        const result = resolveSkillsByName(skillNames, ctx.cwd);
        resolvedSkills = result.skills;
        notFoundSkills = result.notFound;
      }

      // Validate: diff is required
      if (!diff) {
        const error = "Diff scope is required.";
        return {
          content: [{ type: "text" as const, text: `Error: ${error}` }],
          details: {
            _renderKey: toolCallId,
            diff: "",
            focus,
            context,
            skills: skillNames,
            skillsResolved: resolvedSkills.length,
            skillsNotFound:
              notFoundSkills.length > 0 ? notFoundSkills : undefined,
            toolCalls: [],
            error,
            cwd: ctx.cwd,
          },
        };
      }

      let resolvedModel: { provider: string; id: string } | undefined;

      let currentToolCalls: SubagentToolCall[] = [];

      try {
        const model = selectModelForSubagent("reviewer", ctx);
        resolvedModel = { provider: model.provider, id: model.id };

        // Publish resolved provider/model as early as possible for footer rendering.
        onUpdate?.({
          content: [{ type: "text", text: "" }],
          details: {
            _renderKey: toolCallId,
            diff,
            focus,
            context,
            skills: skillNames,
            skillsResolved: resolvedSkills.length,
            skillsNotFound:
              notFoundSkills.length > 0 ? notFoundSkills : undefined,
            toolCalls: currentToolCalls,
            resolvedModel,
            cwd: ctx.cwd,
          },
        });

        let userMessage = buildUserMessage(args);

        // Append warning if skills not found
        if (notFoundSkills.length > 0) {
          userMessage += `\n\n**Note:** The following skills were not found and could not be loaded: ${notFoundSkills.join(", ")}`;
        }

        const bashTool = createBashTool(ctx.cwd) as ReturnType<
          typeof createReadOnlyTools
        >[number];
        const tools = [...createReadOnlyTools(ctx.cwd), bashTool];

        const result = await executeSubagent(
          {
            name: "reviewer",
            model,
            systemPrompt: REVIEWER_SYSTEM_PROMPT,
            skills: resolvedSkills,
            tools: ["read", "grep", "find", "ls", "bash"],
            customTools: [...tools, ...createReviewerTools()],
            thinkingLevel: "low",
            logging: {
              enabled: true,
              debug: isDebugEnabled(),
            },
          },
          userMessage,
          ctx,
          // onTextUpdate
          (_delta, _accumulated) => {
            onUpdate?.({
              content: [{ type: "text", text: "" }],
              details: {
                _renderKey: toolCallId,
                diff,
                focus,
                context,
                skills: skillNames,
                skillsResolved: resolvedSkills.length,
                skillsNotFound:
                  notFoundSkills.length > 0 ? notFoundSkills : undefined,
                toolCalls: currentToolCalls,
                resolvedModel,
                cwd: ctx.cwd,
              },
            });
          },
          signal,
          // onToolUpdate
          (toolCalls: SubagentToolCall[]) => {
            currentToolCalls = toolCalls;
            onUpdate?.({
              content: [{ type: "text", text: "" }],
              details: {
                _renderKey: toolCallId,
                diff,
                focus,
                context,
                skills: skillNames,
                skillsResolved: resolvedSkills.length,
                skillsNotFound:
                  notFoundSkills.length > 0 ? notFoundSkills : undefined,
                toolCalls: currentToolCalls,
                resolvedModel,
                cwd: ctx.cwd,
              },
            });
          },
        );

        const finalToolCalls =
          result.toolCalls.length > 0 ? result.toolCalls : currentToolCalls;

        if (result.aborted) {
          return {
            content: [{ type: "text" as const, text: "Aborted" }],
            details: {
              _renderKey: toolCallId,
              diff,
              focus,
              context,
              skills: skillNames,
              skillsResolved: resolvedSkills.length,
              skillsNotFound:
                notFoundSkills.length > 0 ? notFoundSkills : undefined,
              toolCalls: finalToolCalls,
              aborted: true,
              usage: result.usage,
              resolvedModel,
              cwd: ctx.cwd,
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
              diff,
              focus,
              context,
              skills: skillNames,
              skillsResolved: resolvedSkills.length,
              skillsNotFound:
                notFoundSkills.length > 0 ? notFoundSkills : undefined,
              toolCalls: finalToolCalls,
              error: result.error,
              usage: result.usage,
              resolvedModel,
              cwd: ctx.cwd,
            },
          };
        }

        // Check if all tool calls failed
        const errorCount = finalToolCalls.filter(
          (tc) => tc.status === "error",
        ).length;
        const allFailed =
          finalToolCalls.length > 0 && errorCount === finalToolCalls.length;

        if (allFailed) {
          const error = "All tool calls failed";
          return {
            content: [{ type: "text" as const, text: `Error: ${error}` }],
            details: {
              _renderKey: toolCallId,
              diff,
              focus,
              context,
              skills: skillNames,
              skillsResolved: resolvedSkills.length,
              skillsNotFound:
                notFoundSkills.length > 0 ? notFoundSkills : undefined,
              toolCalls: finalToolCalls,
              error,
              usage: result.usage,
              resolvedModel,
              cwd: ctx.cwd,
            },
          };
        }

        return {
          content: [{ type: "text" as const, text: result.content }],
          details: {
            _renderKey: toolCallId,
            diff,
            focus,
            context,
            skills: skillNames,
            skillsResolved: resolvedSkills.length,
            skillsNotFound:
              notFoundSkills.length > 0 ? notFoundSkills : undefined,
            toolCalls: finalToolCalls,
            response: result.content,
            usage: result.usage,
            resolvedModel,
            cwd: ctx.cwd,
          },
        };
      } finally {
      }
    },

    renderCall(args, theme) {
      const diff = args.diff?.trim() ?? "";
      const shortDiff = diff.length > 80 ? `${diff.slice(0, 77)}...` : diff;

      return new ToolCallHeader(
        {
          toolName: "Reviewer",
          mainArg: shortDiff,
          optionArgs: [
            ...(args.focus ? [{ label: "focus", value: args.focus }] : []),
            ...(args.skills?.length
              ? [{ label: "skills", value: args.skills.join(",") }]
              : []),
          ],
          longArgs: [
            ...(diff.length > 80 ? [{ label: "diff", value: diff }] : []),
            ...(args.context
              ? [{ label: "context", value: args.context }]
              : []),
          ],
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<ReviewerDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const { details } = result;

      // Fallback if details missing
      if (!details) {
        return renderToolTextFallback(result, theme);
      }

      const {
        _renderKey,
        toolCalls,
        response,
        aborted,
        error,
        usage,
        resolvedModel,
        cwd,
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
      const formatToolCall = createReviewerToolFormatter(cwd);

      if (aborted) {
        fields.push({ label: "Status", value: "Aborted" });
      } else if (error) {
        fields.push({ label: "Error", value: error });
      } else if (response) {
        // Done state
        if (isDebugEnabled()) {
          fields.push(new ToolCallList(toolCalls, formatToolCall, theme));
        } else {
          fields.push(new ToolCallSummary(toolCalls, formatToolCall, theme));
        }
        fields.push(new FailedToolCalls(toolCalls, formatToolCall, theme));

        if (mdResponse) {
          mdResponse.setContent(response);
        } else {
          mdResponse = new MarkdownResponse(response, theme);
        }
        fields.push(mdResponse);
      } else {
        // Running state
        fields.push(new ToolCallList(toolCalls, formatToolCall, theme));
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

/** Execute the reviewer subagent directly (without tool wrapper) */
export async function executeReviewer(
  input: ReviewerInput,
  ctx: ExtensionContext,
  onUpdate?: AgentToolUpdateCallback<ReviewerDetails>,
  signal?: AbortSignal,
): Promise<AgentToolResult<ReviewerDetails>> {
  const tool = createReviewerTool();
  return tool.execute("direct", input, signal, onUpdate, ctx);
}
