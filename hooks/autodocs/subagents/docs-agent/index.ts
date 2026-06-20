/**
 * Docs subagent factory.
 *
 * Two internal subagents sharing a generic system prompt and the autodocs
 * skills:
 *   - docs-agent   (check, read-only): returns a DocsCheckResult via the
 *                  required submit_check tool.
 *   - docs-applier (apply, write):    applies a target plan and returns a
 *                  short text summary.
 *
 * Both are invoked programmatically via runWithParams from the hook and the
 * /docs commands. Neither is registered as an LLM-callable tool.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ExtensionAPI,
  type ExtensionContext,
  loadSkillsFromDir,
} from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import type { DocsCheckResult } from "../../lib/types";
import { buildPrompt, DOCS_AGENT_SYSTEM_PROMPT } from "./prompt";
import { type CheckHolder, createApplyTools, createCheckTools } from "./tools";
import { DocsAgentParams } from "./types";

/** Resolve the bundled autodocs skills directory (lives under hooks/autodocs/skills). */
function resolveSkillsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // subagents/docs-agent/ -> ../../skills
  return path.resolve(here, "..", "..", "skills");
}

export interface DocsSubagents {
  /** Run a read-only drift/audit check. Returns the subagent's assessment, or undefined if it failed to call submit_check. */
  runCheck: (
    params: {
      reason: "audit" | "drift";
      sessionId: string;
      docsPath: string;
      fromSha?: string;
      toSha?: string;
    },
    ctx: ExtensionContext,
  ) => Promise<DocsCheckResult | undefined>;
  /** Run a write apply pass against a target plan. Returns the subagent's text summary. */
  runApply: (
    params: {
      sessionId: string;
      docsPath: string;
      plan: string;
    },
    ctx: ExtensionContext,
  ) => Promise<string>;
}

/** Create and subscribe the docs subagents. Call once per extension load. */
export function createDocsSubagents(pi: ExtensionAPI): DocsSubagents {
  const skillsDir = resolveSkillsDir();
  const resolveSkills = () => {
    try {
      return loadSkillsFromDir({ dir: skillsDir, source: "autodocs" }).skills;
    } catch {
      return [];
    }
  };

  // Shared holder for the check subagent's submit_check call. Safe because the
  // state machine prevents overlapping checks; runCheck resets it per call.
  const checkHolder: CheckHolder = {};

  const check = createSubagent(pi, {
    name: "docs-agent",
    label: "Docs Agent",
    description:
      "Read-only docs-keeping subagent. Checks whether docs drifted from the codebase and returns a brief + target plan.",
    systemPrompt: DOCS_AGENT_SYSTEM_PROMPT,
    parameters: DocsAgentParams,
    buildPrompt,
    tools: createCheckTools(checkHolder),
    resolveSkills,
    modelPreferences: [
      {
        provider: "openai-codex",
        model: "gpt-5.3-codex-spark",
        thinking: "off",
        weight: 1,
      },
      {
        provider: "synthetic",
        model: "hf:zai-org/GLM-4.7-Flash",
        thinking: "off",
        weight: 1,
      },
      {
        provider: "neuralwatt",
        model: "glm-5.2-fast",
        thinking: "off",
        weight: 1,
      },
    ],
    resumable: false,
  });

  const apply = createSubagent(pi, {
    name: "docs-applier",
    label: "Docs Applier",
    description:
      "Write-capable docs subagent. Applies a target plan to create, update, or archive doc files.",
    systemPrompt: DOCS_AGENT_SYSTEM_PROMPT,
    parameters: DocsAgentParams,
    buildPrompt,
    tools: createApplyTools(),
    resolveSkills,
    modelPreferences: [
      {
        provider: "openai-codex",
        model: "gpt-5.3-codex-spark",
        thinking: "off",
        weight: 1,
      },
      {
        provider: "synthetic",
        model: "hf:zai-org/GLM-4.7-Flash",
        thinking: "off",
        weight: 1,
      },
      {
        provider: "neuralwatt",
        model: "glm-5.2-fast",
        thinking: "off",
        weight: 1,
      },
    ],
    resumable: false,
  });

  // Subscribe to lifecycle events (session_start/shutdown) without exposing
  // either subagent as an LLM-callable tool.
  check.register({ tool: false });
  apply.register({ tool: false });

  return {
    async runCheck(params, ctx) {
      checkHolder.result = undefined;
      await check.runWithParams({ mode: "check", ...params }, { ctx });
      return checkHolder.result;
    },
    async runApply(params, ctx) {
      const result = await apply.runWithParams(
        { mode: "apply", reason: "audit", ...params },
        { ctx },
      );
      return extractText(result.content);
    },
  };
}

/** Join the text parts of a tool result's content into a single string. */
function extractText(
  content: Array<{ type: string; text?: string } | { type: string }>,
): string {
  return content
    .map((part) =>
      "text" in part && typeof part.text === "string" ? part.text : "",
    )
    .join("")
    .trim();
}
