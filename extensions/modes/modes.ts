import type { ModeColor } from "@harness/events";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";

export interface ModeSpec {
  name: string;
  label: string;
  labelColor: ModeColor;
  provider?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  systemPrompt?: string;
  description?: string;
  /** Tools enabled without gating. Empty = all tools allowed. */
  allowedTools: string[];
  /** Tools enabled but requiring confirmation per call. */
  gatedTools: string[];
}

export const MODE_ORDER: string[] = ["balanced", "research"];

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const BALANCED_PROMPT = `You are Pi, an expert coding assistant.

Be concise. Sacrifice grammar for brevity. Let code speak for itself.

- Prefer parallel tool calls for independent operations.
- Use specialized tools (read, grep, find, ls) over bash for file exploration.
- Never propose changes to code you have not read.
- Match existing code style, conventions, and libraries.
- Work incrementally: small change, verify, continue.
- Do not add features, refactor code, or make improvements beyond what was asked.`;

const RESEARCH_PROMPT = `You are Pi, an expert coding assistant in RESEARCH MODE.

Analyze, research, and plan. Do not modify files or system state.

- Use read, grep, find, ls for local code exploration.
- Use scout, lookout, oracle for deep investigation.
- Read relevant code before drawing conclusions.
- Prefer deep exploration and evidence-backed findings.
- Cite file paths for non-obvious claims.
- Give the smallest answer that fully covers the question.
- End with open questions only if there are real blockers or ambiguities.`;

// ---------------------------------------------------------------------------
// Mode definitions
// ---------------------------------------------------------------------------

export const MODES: Record<string, ModeSpec> = {
  balanced: {
    name: "balanced",
    label: "balanced",
    labelColor: { source: "raw", color: "#777777" },
    description: "All tools, default model",
    systemPrompt: BALANCED_PROMPT,
    allowedTools: [],
    gatedTools: [],
  },
  research: {
    name: "research",
    label: "research",
    labelColor: { source: "raw", color: "#5f8faf" },
    description: "Read-only + research, high thinking (Claude Opus)",
    provider: "anthropic",
    model: "claude-opus-4-6",
    thinkingLevel: "medium",
    systemPrompt: RESEARCH_PROMPT,
    allowedTools: [
      "read",
      "ls",
      "find",
      "grep",
      "get_current_time",
      "read_url",
      "find_sessions",
      "list_sessions",
      "read_session",
      "ask_user",
      "synthetic_web_search",
      "linkup_web_search",
      "linkup_web_answer",
      "linkup_web_fetch",
      "scout",
      "lookout",
      "oracle",
      "reviewer",
      "switch_mode",
    ],
    gatedTools: ["bash"],
  },
};

export const DEFAULT_MODE = MODES.balanced as ModeSpec;
