import { type Static, Type } from "typebox";

/**
 * Parameters for the docs subagent.
 *
 * The subagent is internal-only (invoked via runWithParams from the hook and
 * commands, never registered as an LLM tool), so this schema documents the
 * shape we pass programmatically. Mode is part of the invocation, not the
 * system prompt: buildPrompt() branches on it.
 */
export const DocsAgentParams = Type.Object({
  mode: Type.Union([Type.Literal("check"), Type.Literal("apply")]),
  /** Why the check is running: an on-demand audit or a post-git drift check. */
  reason: Type.Union([Type.Literal("audit"), Type.Literal("drift")]),
  /** Parent session id, so the subagent can read_session for context. */
  sessionId: Type.String(),
  /** Repo-relative docs directory, e.g. "docs". */
  docsPath: Type.String(),
  /** Range start (drift only). */
  fromSha: Type.Optional(Type.String()),
  /** Range end (drift only). */
  toSha: Type.Optional(Type.String()),
  /** JSON-encoded DocsTarget[] plan to apply (apply mode only). */
  plan: Type.Optional(Type.String()),
});

export type DocsAgentParamsType = Static<typeof DocsAgentParams>;
