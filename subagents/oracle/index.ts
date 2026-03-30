/**
 * Oracle subagent - expert AI advisor for complex reasoning.
 *
 * Uses GPT-5.2 for architecture planning, code review, and strategic guidance.
 * Advisory-only (no tools) - invoked zero-shot with no follow-ups.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
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
  Skill,
  Theme,
  ToolDefinition,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { isDebugEnabled } from "@subagents/config";
import { executeSubagent, resolveSkillsByName } from "@subagents/lib";
import { selectModelForSubagent } from "@subagents/lib/subagent-model-selection";
import { ORACLE_SYSTEM_PROMPT } from "@subagents/oracle/system-prompt";
import { createOracleTools } from "@subagents/oracle/tools";
import type { OracleDetails, OracleInput } from "@subagents/oracle/types";

/** System prompt guidance for oracle tool usage */
export const ORACLE_GUIDANCE = `
## Oracle

Use oracle when making plans, reviewing your own work, understanding existing code behavior, or debugging code that does not work.

When calling oracle, tell the user why: "I'm going to ask the oracle for advice" or "I need to consult with the oracle."

### Oracle Examples

**Architecture review:**
- User: "review the authentication system we just built"
- Action: use oracle with relevant files to analyze architecture, then improve based on response

**Debugging:**
- User: "I'm getting race conditions when I run this test"
- Action: run test to confirm, then use oracle with files and context about test run and race condition

**Planning:**
- User: "plan the implementation of real-time collaboration features"
- Action: use lookout to locate relevant files, then use oracle to plan implementation

**Implementation guidance:**
- User: "implement a new user authentication system with JWT tokens"
- Action: use oracle to analyze current patterns and plan approach, then proceed with implementation

**Optimization:**
- User: "I need to optimize this slow database query"
- Action: use oracle to analyze performance issues and get recommendations, then implement
`;

const parameters = Type.Object({
  task: Type.String({ description: "What to help with" }),
  context: Type.Optional(Type.String({ description: "Background info" })),
  files: Type.Optional(
    Type.Array(Type.String(), { description: "Files to examine" }),
  ),
  skills: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Skill names to provide specialized context (e.g., 'ios-26', 'drizzle-orm')",
    }),
  ),
});

/** Format files for context */
async function formatFilesForContext(
  files: string[],
  cwd: string,
): Promise<string> {
  const contents: string[] = [];

  for (const file of files) {
    const fullPath = path.resolve(cwd, file);
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      contents.push(`### ${file}\n\`\`\`\n${content}\n\`\`\``);
    } catch {
      contents.push(`### ${file}\n(file not found or unreadable)`);
    }
  }

  return contents.join("\n\n");
}

/** Build the user message for the subagent based on inputs */
function buildUserMessage(input: OracleInput, filesContent?: string): string {
  let userMessage = `## Task\n${input.task}`;

  if (input.context) {
    userMessage += `\n\n## Context\n${input.context}`;
  }

  if (filesContent) {
    userMessage += `\n\n## Files\n${filesContent}`;
  }

  return userMessage;
}

/** Create the oracle tool definition for use in extensions */
export function createOracleTool(): ToolDefinition<
  typeof parameters,
  OracleDetails
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
    name: "subagent.oracle",
    label: "Oracle",
    description: `Consult the Oracle - an AI advisor powered by GPT-5 for complex reasoning.

WHEN TO USE:
- Code reviews and architecture feedback
- Finding bugs across multiple files
- Planning complex implementations or refactoring
- Deep technical questions requiring reasoning

WHEN NOT TO USE:
- Simple file reading (use read)
- Codebase searches (use lookout)
- Basic code modifications (do it yourself or use task)

Pass relevant skills (e.g., 'ios-26', 'drizzle-orm') to provide specialized context for the task.`,
    promptSnippet:
      "Ask an expert advisor for planning, debugging, or architecture feedback.",
    promptGuidelines: [
      "Use this tool for plans, architecture review, debugging guidance, and complex reasoning across files.",
      "Before calling it, tell the user you are consulting the oracle and why.",
      "Prefer read or lookout for simple file inspection or code search first.",
    ],

    parameters,

    async execute(
      toolCallId: string,
      args: OracleInput,
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<OracleDetails> | undefined,
      ctx: ExtensionContext,
    ) {
      const { task, context, files, skills: skillNames } = args;

      // Resolve skills if provided
      let resolvedSkills: Skill[] = [];
      let notFoundSkills: string[] = [];

      if (skillNames && skillNames.length > 0) {
        const result = resolveSkillsByName(skillNames, ctx.cwd);
        resolvedSkills = result.skills;
        notFoundSkills = result.notFound;
      }

      let resolvedModel: { provider: string; id: string } | undefined;

      const model = selectModelForSubagent("oracle", ctx);
      resolvedModel = { provider: model.provider, id: model.id };

      // Publish resolved provider/model as early as possible for footer rendering.
      onUpdate?.({
        content: [{ type: "text", text: "" }],
        details: {
          _renderKey: toolCallId,
          task,
          context,
          files,
          skills: skillNames,
          skillsResolved: resolvedSkills.length,
          skillsNotFound:
            notFoundSkills.length > 0 ? notFoundSkills : undefined,
          toolCalls: [],
          resolvedModel,
        },
      });

      // Format files if provided
      let filesContent: string | undefined;
      if (files && files.length > 0) {
        filesContent = await formatFilesForContext(files, ctx.cwd);
      }

      let userMessage = buildUserMessage(args, filesContent);

      // Append warning if skills not found
      if (notFoundSkills.length > 0) {
        userMessage += `\n\n**Note:** The following skills were not found and could not be loaded: ${notFoundSkills.join(", ")}`;
      }

      const result = await executeSubagent(
        {
          name: "subagent.oracle",
          model,
          systemPrompt: ORACLE_SYSTEM_PROMPT,
          skills: resolvedSkills,
          customTools: createOracleTools(),
          thinkingLevel: "low",
          logging: {
            enabled: true,
            debug: isDebugEnabled(),
          },
        },
        userMessage,
        ctx,
        // onTextUpdate
        (_delta, accumulated) => {
          onUpdate?.({
            content: [{ type: "text", text: accumulated }],
            details: {
              _renderKey: toolCallId,
              task,
              context,
              files,
              skills: skillNames,
              skillsResolved: resolvedSkills.length,
              skillsNotFound:
                notFoundSkills.length > 0 ? notFoundSkills : undefined,
              toolCalls: [],
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
            task,
            context,
            files,
            skills: skillNames,
            skillsResolved: resolvedSkills.length,
            skillsNotFound:
              notFoundSkills.length > 0 ? notFoundSkills : undefined,
            toolCalls: [],
            aborted: true,
            usage: result.usage,
            resolvedModel,
          },
        };
      }

      // Throw on error so the tool call is marked as failed
      if (result.error) {
        throw new Error(result.error);
      }

      return {
        content: [{ type: "text" as const, text: result.content }],
        details: {
          _renderKey: toolCallId,
          task,
          context,
          files,
          skills: skillNames,
          skillsResolved: resolvedSkills.length,
          skillsNotFound:
            notFoundSkills.length > 0 ? notFoundSkills : undefined,
          toolCalls: [],
          response: result.content,
          usage: result.usage,
          resolvedModel,
        },
      };
    },

    renderCall(args, theme) {
      const task = args.task?.trim() ?? "";

      return new ToolCallHeader(
        {
          toolName: "Oracle",
          optionArgs: [
            ...(args.files?.length
              ? [
                  {
                    label: "files",
                    value: String(args.files.length),
                  },
                ]
              : []),
            ...(args.skills?.length
              ? [{ label: "skills", value: args.skills.join(",") }]
              : []),
          ],
          longArgs: [
            ...(task ? [{ label: "task", value: task }] : []),
            ...(args.context
              ? [{ label: "context", value: args.context }]
              : []),
          ],
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<OracleDetails>,
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
        response,
        aborted,
        error,
        usage,
        toolCalls,
        resolvedModel,
        task,
        context,
        files,
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
        if (task) {
          fields.push({ label: "Task", value: task });
        }
        if (context) {
          fields.push({ label: "Context", value: context });
        }
        if (files?.length) {
          fields.push({ label: "Files", value: files.join(", ") });
        }

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

/** Execute the oracle subagent directly (without tool wrapper) */
export async function executeOracle(
  input: OracleInput,
  ctx: ExtensionContext,
  onUpdate?: AgentToolUpdateCallback<OracleDetails>,
  signal?: AbortSignal,
): Promise<AgentToolResult<OracleDetails>> {
  const tool = createOracleTool();
  return tool.execute("direct", input, signal, onUpdate, ctx);
}
