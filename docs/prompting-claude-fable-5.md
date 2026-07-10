# Prompting Claude Fable 5

Claude Fable 5 is Anthropic's highest-capability generally available model for long-horizon, tool-using work. This guide is model guidance, not a contract for any one harness. Apply it when choosing prompts, tools, effort, context handling, and verification for Fable 5.

## Model profile

- Best fit: difficult, ambiguous, multi-stage work where sustained autonomy, judgement, code review, research, or visual understanding matters more than latency and cost.
- Context: 1M tokens; up to 128K output tokens. Long context is useful only when the task gives the model a retrieval path and clear priorities.
- Reasoning: adaptive thinking is always on. `effort` is the primary quality, latency, and cost control; raw chain-of-thought is not returned.
- Safety: classifier refusals return a successful response with `stop_reason: "refusal"`. They can cover offensive cyber, biology/life-science, and reasoning-extraction requests. Plan an explicit fallback such as Opus 4.8 when a refused benign task must continue.
- Operational profile: hard turns can run for minutes and autonomous jobs can run much longer. Stream output, use appropriate client timeouts, and do not assume every request is interactive.

Simon Willison found Fable notably proactive and strong at API design, testing, and finding release blockers when given an open, concrete review goal. This makes it effective for broad ownership, but increases the need to define scope and permissions.

## Write a complete task contract

Fable can resolve ambiguity, but it should not have to invent the product contract. State the outcome, why it matters, relevant context, constraints, proof of success, and the requested deliverable. Give it the reason behind important constraints, not just the constraint.

```text
Outcome: prevent duplicate invoice records from repeated provider webhooks.
Why: duplicate invoices corrupt customer billing history.
Constraints: preserve valid retry behavior; do not redesign the billing flow.
Evidence: add a focused regression test and run the affected test suite.
Deliverable: implement the smallest safe fix and report changed files, test result, and residual risk.
```

Specify whether the request is advice, a plan, an investigation, or an implementation. Specify permissions for destructive actions, external writes, and scope expansion. When the model is only being asked to assess a problem, tell it to report findings and stop rather than applying a fix.

For tasks with several valid paths, ask for a recommendation and the decisive trade-off. Do not request an exhaustive option survey unless comparison itself is the deliverable.

## Keep prompts brief and remove obsolete scaffolding

Fable follows concise instructions strongly. Move durable rules into repository guidance, tool descriptions, and system prompts. Keep the task prompt specific to the current outcome. Old step-by-step scaffolding can cause duplicated planning, verbose progress reports, or unnecessary tool calls.

For ambiguous work at high effort, add this boundary:

```text
When you have enough information to act, act. Do not re-derive established facts,
re-litigate settled decisions, or narrate options you will not pursue. If a choice
remains, recommend one path.
```

For narrowly scoped changes, counter unnecessary ownership with an explicit limit:

```text
Implement only what the task requires. Do not add features, opportunistic refactors,
new abstractions, compatibility shims, or speculative validation. Use the simplest
solution that preserves the stated behavior.
```

Do not ask Fable to reveal or reproduce hidden reasoning. Ask for conclusions, supporting evidence, assumptions, and next checks. Prompts that request internal reasoning can trigger a `reasoning_extraction` refusal.

## Control autonomy, tool use, and checkpoints

State when Fable may proceed autonomously and what requires a pause. It is well suited to reversible actions implied by the request; it should pause for destructive or irreversible work, a genuine scope change, or information only the user can supply.

```text
Proceed through reversible work implied by this request. Pause only for destructive
or irreversible actions, a material scope change, or missing user-only information.
Do not end with a promise to perform work you can perform with the available tools.
```

Use precise tool descriptions with authority boundaries and expected output. For fresh, repository-specific, or user-specific facts, require tool evidence rather than model memory. On long tasks, ask for progress updates only at meaningful milestones and tie every claim to a tool result:

```text
Before reporting progress, verify every claim against a result from this session.
State failed or skipped checks plainly; distinguish verified facts from assumptions.
```

Fable can delegate independent work effectively. Give subagents independent scopes, shared success criteria, and an explicit synthesis responsibility. Do not delegate a small task that the parent can finish directly. For high-risk work, prefer a fresh-context verifier over asking the same agent to critique itself.

## Reasoning, context, and memory

Start at `high` for most work. Use `xhigh` for the hardest long-horizon, review, or judgement-heavy work; measure `max`, because its additional spend can overthink. Use `medium` or `low` for routine, bounded, latency-sensitive tasks. Tune effort before adding prompt ceremony.

Adaptive thinking cannot be disabled. Do not make the model simulate a reasoning mode in the prompt. Set a sufficient output budget for high-effort tool loops, stream long responses, and preserve returned thinking blocks unchanged when continuing the same model conversation.

For large inputs, name the relevant files, sections, dates, entities, and decision criteria. Ask the model to build a short working inventory before making fine-grained claims. Prefer a retrieval or search step over asking it to absorb an entire repository indiscriminately.

Fable benefits from durable memory for lessons that are not already in the repository or conversation. Store concise, dated, validated notes in a known location; update or remove stale notes rather than accumulating duplicate instructions. Do not expose a remaining-context countdown to the model unless the harness needs it, since it can prompt unnecessary handoffs.

## Common failure modes

| Symptom | Prompt or harness response |
| --- | --- |
| Overplanning, repeated facts, or unused options | State the decision boundary and tell it to act once evidence is sufficient. Lower effort for routine work. |
| Unrequested cleanup or broadened implementation | Name excluded work and require the smallest correct change. |
| Unsupported progress claim | Require tool-grounded progress reporting and surface failed checks. |
| Asks permission after the task is already specified | Define the small set of actions that genuinely need approval. |
| Stops with an intent rather than a tool call | In autonomous runs, require completion or a concrete blocker before ending. |
| Refusal on a legitimate task | Inspect `stop_reason` and classifier details; use documented fallback rather than retrying blindly. |
| Long run appears stalled | Stream, increase client timeouts, display meaningful milestone updates, and run asynchronously where possible. |

## Sources

- Anthropic, [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)
- Anthropic, [Introducing Claude Fable 5 and Claude Mythos 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5)
- Anthropic, [Transparency Hub model report](https://www.anthropic.com/transparency/model-report)
- Simon Willison, [Initial impressions of Claude Fable 5](https://simonwillison.net/2026/Jun/9/claude-fable-5/)
