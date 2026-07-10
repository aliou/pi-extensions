import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SubagentPromptResult } from "@harness/agent-kit/types";
import { knownModelFamily, type ModelIdentity } from "@harness/models";
import { assertNever } from "@harness/utils";
import type { ReviewerParamsType } from "./types";

export const REVIEWER_SYSTEM_PROMPT = `You are an expert senior engineer with deep knowledge of software engineering best practices, security, performance, and maintainability.

Your task is to perform a thorough code review of the provided diff description. The diff description might be a git or bash command that generates the diff or a description of the diff which can then be used to generate the git or bash command to generate the full diff.

Use the git_diff tool when you need to generate the diff from the provided diff description.

After reading the diff, do the following:
1. Generate a high-level summary of the changes in the diff.
2. Go file-by-file and review each changed hunk.
3. Comment on what changed in that hunk (including the line range) and how it relates to other
   changed hunks and code, reading any other relevant files. Also call out bugs, hackiness,
   unnecessary code, or too much shared mutable state.
4. Evaluate abstraction fit in both directions: flag unnecessary indirection (over-abstraction)
   and missing abstractions (duplication or branching complexity). For each finding, cite concrete
   locations and recommend exactly one action—simplify/inline or introduce/extract a shared
   concept—only when it improves current code (avoid speculative refactors).

Stop rules:
- Read the diff and the referenced files once. Do not re-read or re-search the same paths.
- Stop once every changed hunk has been reviewed. Do not explore unrelated parts of the repo.
- Only your last message is returned to the main agent. Make it the complete review.`;

export function buildPrompt(
  params: ReviewerParamsType,
  _ctx: ExtensionContext,
  model: ModelIdentity,
): SubagentPromptResult {
  const family = knownModelFamily(model);

  switch (family) {
    case "glm-5.2":
      return { text: buildGlmReviewerPrompt(params) };
    case "gpt-5.5":
      return { text: buildGptReviewerPrompt(params) };
    case "glm-4.7-flash":
    case "kimi-k2.7-code":
    case undefined:
      return { text: buildGenericReviewerPrompt(params) };
    default:
      return assertNever(family);
  }
}

export function buildGptReviewerPrompt(params: ReviewerParamsType): string {
  return [
    `Use a formal review shape optimized for highest-impact findings. Start from correctness, regressions, security, data loss, and maintainability risks before style or preference.`,
    "",
    ...inputLines(params),
    "",
    `Review contract:`,
    `- Return only findings that are actionable and supported by the diff or inspected files.`,
    `- Use severity labels when useful: critical, high, medium, low.`,
    `- Prefer one concrete remediation per finding.`,
    `- If there are no material findings, say so directly and list residual risks briefly.`,
  ].join("\n");
}

export function buildGlmReviewerPrompt(params: ReviewerParamsType): string {
  return [
    `Treat this as a bounded static review. Be explicit about evidence, changed hunks, and verified gaps.`,
    "",
    ...inputLines(params),
    "",
    `Evidence contract:`,
    `- Generate or inspect the diff before making findings.`,
    `- Cite concrete files and line ranges for every finding.`,
    `- If a concern cannot be verified from the diff or files, put it under residual risks instead of presenting it as a finding.`,
    `- Keep the output narrow: findings first, no broad refactor wishlist.`,
  ].join("\n");
}

export function buildGenericReviewerPrompt(params: ReviewerParamsType): string {
  return inputLines(params).join("\n");
}

function inputLines(params: ReviewerParamsType): string[] {
  const lines = [
    `Diff description:`,
    `<diff_description>`,
    params.diff_description,
    `</diff_description>`,
  ];

  if (params.instructions) {
    lines.push(
      "",
      `Additional instructions:`,
      `<instructions>`,
      params.instructions,
      `</instructions>`,
    );
  }

  return lines;
}
