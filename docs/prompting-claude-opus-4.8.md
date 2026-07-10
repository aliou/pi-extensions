# Prompting Claude Opus 4.8

Claude Opus 4.8 is a premium model for complex coding, tool-using agents, knowledge work, and long-context tasks. This is general model guidance; it does not assume a particular subagent or harness.

## Model profile

- Best fit: difficult production engineering, multi-tool analysis, review, research, documents, and vision where high reliability is worth the cost.
- Context: 1M tokens by default; up to 128K output tokens.
- Reasoning: adaptive thinking is available only when requested. Effort is `low`, `medium`, `high`, `xhigh`, or `max`; `high` is the API default.
- Parameters: do not set non-default `temperature`, `top_p`, or `top_k`; Opus 4.8 rejects them. Use effort and prompt constraints instead.
- Operational behavior: literal instruction following is stronger than earlier Claude models. It may reason rather than call tools unless tools are explicitly required.

## State the task and its scope literally

Write the task as a testable contract: outcome, applicable scope, constraints, available evidence, verification, and final response shape. If an instruction applies to every file, item, or section, say so. Do not rely on the model to generalize an example or infer unstated product judgement.

```text
Investigate the startup regression after workspace indexing changed.
Inspect the startup path and existing timing hooks. Do not change indexing semantics.
Report: evidence for the regression, smallest safe fix, affected files, and a focused
validation command. Implement only if the fix is local and reversible.
```

Use explicit boundaries for potentially consequential work: read-only investigation versus implementation, local changes versus external writes, and what needs approval. For ambiguous briefs, either ask the one missing decision or name the simplest allowed interpretation.

## Match effort to the workload

Start at `xhigh` for hard coding and agentic work, and at least `high` for intelligence-sensitive work. Use `medium` when cost matters and `low` only for short, clearly bounded, latency-sensitive work. At low and medium effort, Opus intentionally does only the stated work; do not expect it to go beyond the prompt.

Test `max` only when measured quality justifies its additional tokens; it can overthink. If a task is shallow at a fixed low effort, first raise effort. Add a targeted instruction to think through a multi-step problem only when the runtime level cannot change.

Adaptive thinking is off unless the API request sets `thinking: { type: "adaptive" }`. For long high-effort tool loops, allow a large output budget; Anthropic recommends starting at 64K tokens for `xhigh` or `max` and then measuring. Do not request private reasoning in the final output.

## Make evidence and tool use explicit

Opus often prefers reasoning to a tool call. For a fact that requires current, file-specific, or user-specific evidence, name the tool and what it must establish:

```text
Read the supplied files before making file-specific claims. Use repository history only
if it can distinguish the regression from an older behavior. Cite the path and relevant
symbol for every conclusion that would change the recommended fix.
```

Describe tools narrowly: purpose, authority, input, output, and when they are required. Parallelize independent reads or searches. Require confirmation before destructive or external writes. Let native progress updates stand unless the product requires an exact cadence; artificial "update every N calls" scaffolding is usually unnecessary.

For code review, decide whether the job is coverage or filtering. A conservative severity bar can suppress valid lower-severity findings. For a two-stage review, first request all plausible issues with severity and confidence, then rank or verify them separately. For a one-pass review, define a concrete reporting threshold rather than saying only "important" issues.

## Use long context deliberately

Give the model an index into a large context: relevant paths, time range, entities, definitions, and the answer criteria. Ask it to cite source locations for claims that depend on details. Do not present a whole codebase or document corpus as an invitation to summarize it.

For a persistent task, keep high-value instructions stable and use mid-conversation system messages when API integration must add new instructions without invalidating earlier prompt-cache work. After compaction, reassert the outcome, non-negotiable constraints, verified decisions, and remaining work rather than restarting generic exploration.

## Control output and style

Opus calibrates response length to perceived complexity. Specify the desired final format and use positive examples when a particular communication style matters. A concise focused instruction is sufficient for most cases:

```text
Lead with the conclusion. Include only evidence and caveats that change the next action.
Use complete sentences and short sections; keep examples minimal.
```

For frontend work, give a concrete design direction, existing design-system constraints, and a token palette. Generic requests for "minimal" or requests to avoid a color often cause it to choose another fixed house style. If visual direction is intentionally open, ask for a small set of directions and require selection before implementation.

## Common failure modes

| Symptom | Response |
| --- | --- |
| Model applies a rule only to the example | State the full scope: every item, file, or section. |
| It reasons instead of fetching required evidence | Make tool use mandatory for the named fact and say why. |
| Shallow result on a hard task | Raise effort before adding procedural prompt text. |
| Excessively long analysis | Specify output shape and use positive concise examples. |
| Review recall appears lower after migration | Remove vague conservative filters or separate discovery from filtering. |
| Generic frontend styling | Provide concrete palette, typography, structure, and design-system constraints. |

## Sources

- Anthropic, [Prompting Claude Opus 4.8](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8)
- Anthropic, [What’s new in Claude Opus 4.8](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8)
- Anthropic, [Claude Opus 4.8 model report](https://www.anthropic.com/transparency/model-report)
- Simon Willison, [Claude Opus 4.8: “a modest but tangible improvement”](https://simonwillison.net/2026/May/28/claude-opus-48/)
