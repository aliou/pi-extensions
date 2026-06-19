/**
 * Tool specs for the docs subagent.
 *
 * The check subagent's result is delivered via the required `submit_check`
 * custom tool — the subagent calls it with a structured assessment instead
 * of emitting prose/JSON we'd have to parse. The tool writes into a holder
 * captured by closure; runCheck resets and reads it per invocation. Overlapping
 * checks are already prevented by the state machine, so a shared holder is safe.
 *
 * The apply subagent writes files directly with the native edit/write tools and
 * returns a short text summary (no parsing).
 */

import { defineTool } from "@earendil-works/pi-coding-agent";
import type { SubagentToolSpec } from "@harness/agent-kit/types";
import { Type } from "typebox";
import type { DocsCheckResult, DocsTarget } from "../../lib/types";

/** Mutable holder the submit_check tool writes to. */
export interface CheckHolder {
  result?: DocsCheckResult;
}

const targetSchema = Type.Object({
  path: Type.String({
    description: "Repo-relative doc path, e.g. docs/extensions/autodocs.md.",
  }),
  op: Type.Union([
    Type.Literal("create"),
    Type.Literal("update"),
    Type.Literal("archive"),
  ]),
  hint: Type.Optional(
    Type.String({ description: "Optional rationale / line hint." }),
  ),
});

/** Tools for the check (read-only) subagent, including submit_check. */
export function createCheckTools(holder: CheckHolder): SubagentToolSpec[] {
  return [
    { name: "read", type: "native" },
    { name: "grep", type: "native" },
    { name: "find", type: "native" },
    { name: "read_session", type: "native" },
    {
      name: "submit_check",
      type: "custom",
      spec: () =>
        defineTool({
          name: "submit_check",
          label: "Submit Docs Check",
          description:
            "Submit your docs-drift assessment. Call this exactly once when your check is complete.",
          promptGuidelines: [
            "submit_check: Call this exactly once to submit your docs-drift assessment. Do not return the assessment as text.",
          ],
          parameters: Type.Object({
            needsUpdate: Type.Boolean({
              description:
                "Whether any docs need to be created, updated, or archived.",
            }),
            brief: Type.String({
              description:
                "One short paragraph in plain English summarizing what changed and what docs work it implies. Shown to the user verbatim.",
            }),
            targets: Type.Array(targetSchema, {
              description:
                "Suggested doc targets. May be empty when needsUpdate is false.",
            }),
          }),
          async execute(_toolCallId, params) {
            const targets: DocsTarget[] = (params.targets ?? []).map((t) => ({
              path: t.path,
              op: t.op,
              hint: t.hint,
            }));
            holder.result = {
              needsUpdate: Boolean(params.needsUpdate),
              brief: (params.brief ?? "").trim(),
              targets,
            };
            return {
              content: [{ type: "text", text: "Assessment received." }],
              details: { ok: true },
            };
          },
        }),
    },
  ];
}

/** Tools for the apply (write) subagent. */
export function createApplyTools(): SubagentToolSpec[] {
  return [
    { name: "read", type: "native" },
    { name: "grep", type: "native" },
    { name: "find", type: "native" },
    { name: "read_session", type: "native" },
    { name: "edit", type: "native" },
    { name: "write", type: "native" },
  ];
}
