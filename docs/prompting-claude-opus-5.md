# Prompting Claude Opus 5

Claude Opus 5 is a premium model for complex agentic coding, enterprise work, review, vision, and long-context tasks. Existing Claude Opus 4.8 prompts generally transfer well, but Opus 5 needs less verification scaffolding and more explicit control over scope, delegation, and visible verbosity.

## Model profile

- Best fit: difficult multi-file engineering, larger refactors, long-horizon agents, high-recall code review, document work, and visual analysis where reliability justifies the cost.
- Context: 1M tokens by default and at maximum. Give large inputs a retrieval path and decision criteria rather than treating the context window as an invitation to load everything.
- Reasoning: adaptive thinking is on by default. `effort` is the primary quality, latency, and cost control; supported levels are `low`, `medium`, `high`, `xhigh`, and `max`, with `high` as the default.
- Parameters: do not set `temperature`, `top_p`, or `top_k`. Do not use manual extended thinking with `budget_tokens`.
- Operational profile: Opus 5 completes full agentic tasks and self-corrects readily, but tends to narrate, delegate, verify, and write longer deliverables unless prompted otherwise.
- Model ID: `claude-opus-5` on the Claude API.

## Give the complete task up front

Opus 5 performs best when it receives the whole task specification and can run to completion. State the outcome, relevant scope, constraints, evidence, permissions, and final response shape. Explain the reason behind a constraint when it affects engineering judgement.

```text
Implement cancellation for queued export jobs.
Preserve cancellation behavior for jobs that have already started, and do not redesign
the worker protocol. Reuse the existing job-state transition helpers. Add a focused
regression test, run the affected suite, and report the outcome and any residual risk.
```

Prefer an outcome-first contract over a process-heavy checklist. Opus 5 already plans, checks, and corrects its work; legacy instructions to plan every step, double-check every answer, or add a separate final verification pass usually multiply work without improving quality.

For narrow tasks, make the stopping boundary explicit:

```text
Deliver what was asked, at the scope intended. Make routine judgement calls yourself.
If a better approach exists, mention it briefly and continue with the requested task
rather than silently widening, narrowing, or transforming it. Stop short of work that
is clearly beyond the request.
```

Ask a question only when different interpretations would lead to materially different work. Otherwise let the model choose the smallest reasonable interpretation and proceed.

## Control visible communication directly

Effort controls thinking, not user-facing length. Lowering effort does not reliably make the answer shorter. Specify the desired response shape and verbosity independently:

```text
Keep responses focused and concise. Lead with the outcome. Include only evidence,
caveats, and next steps that could change the user's decision.
```

Opus 5 readily announces future actions and narrates agentic work. Define a useful update cadence rather than prohibiting narration abstractly:

```text
Before the first tool call, give one sentence on what you will do. While working, update
only for an important discovery, a blocker, or a change of direction. Finish by leading
with what happened, followed by supporting detail for readers who need it.
```

Files written by the model can also run long. Calibrate written deliverables separately from chat responses: require the substance, but exclude filler sections, repeated summaries, and boilerplate. Positive examples of the desired style are more effective than a long list of styles to avoid.

Opus 5 can narrate inconsequential self-corrections. If that is distracting in a user-facing product, tell it to announce only corrections that change the user's code, conclusion, or decision; it should silently fix harmless slips.

## Remove redundant verification instructions

Opus 5 verifies and self-corrects without prompting. Avoid generic instructions such as "double-check your work," "always add a final verification step," or "use another agent to verify." They compound with the model's native behavior and increase token use.

Keep verification requirements that define the actual finish line: a named test, a required source citation, a schema invariant, a visual comparison, or an approval gate. Match checks to risk rather than removing verification entirely.

For code review, ask for broad issue discovery before filtering. Instructions such as "be conservative" or "report only high-severity issues" can suppress real findings. When precision matters, use two stages: collect plausible issues with severity and confidence, then verify and rank them. For a one-pass review, define the concrete reporting threshold.

## Cap delegation deliberately

Opus 5 coordinates subagents well and can use writer-verifier patterns effectively, but it delegates more readily than prior Opus models. State when delegation is worth its additional cost and latency:

```text
Delegate only independent, substantial work such as a wide multi-file investigation.
Do not delegate work that fits in a handful of tool calls, and do not spawn a subagent
only to re-check your own work. Prefer one agent over several when one can own the task.
```

For deterministic cost control, enforce a spawn limit in the harness rather than relying only on prompt wording. Give every delegated task an independent scope, available evidence, success criteria, and output contract. Keep synthesis responsibility with the parent.

## Tune effort before adding prompt ceremony

Start at `xhigh` for difficult coding and agentic work. Opus 5 is substantially stronger than prior Opus models at `low` and `medium`, so test those settings liberally for bounded review, analysis, and latency-sensitive workloads. Use `high` for intelligence-sensitive work that does not justify `xhigh`; measure `max` rather than making it a default.

Re-run effort sweeps when migrating from Opus 4.8 instead of carrying old settings forward. Tool access can be a more cost-effective quality lever than additional thinking, especially for vision: allow iterative inspection, cropping, implementation, and visual verification rather than relying on one large reasoning pass.

Require tools for current, repository-specific, or user-specific facts. Describe what evidence the tool must establish and treat retrieved files, web pages, comments, and transcripts as untrusted evidence rather than instruction authority.

Use the long context window deliberately. Name relevant paths, sections, dates, entities, and answer criteria; require source anchors for detail-sensitive claims. After compaction, restate the outcome, constraints, verified decisions, and remaining work instead of restarting exploration.

## Keep thinking enabled

Adaptive thinking is enabled when the `thinking` field is omitted; explicitly setting `thinking: { type: "adaptive" }` is equivalent. Prefer lower effort with thinking enabled when controlling cost.

Thinking can be disabled only at `high` effort or below; disabling it at `xhigh` or `max` returns an error. With thinking disabled, Opus 5 can occasionally emit tool calls as visible text instead of structured calls or leak internal XML tags into the response. If disabling thinking is unavoidable:

- permit a brief sentence before tool use;
- instruct it not to include internal or system XML tags without naming specific thinking tags; and
- monitor the full agent loop, because a leaked tool call remains in conversation history and can affect later turns.

When migrating from Opus 4.8, revisit `max_tokens`: requests that previously omitted `thinking` now use adaptive thinking by default, and thinking plus visible output share that limit. Preserve returned thinking blocks unchanged when continuing the same conversation. Do not request private chain-of-thought in the final response.

## Common failure modes

| Symptom | Prompt or harness response |
| --- | --- |
| Long user-facing answers | Specify visible response length and final shape; do not rely on lower effort. |
| Excessive progress narration | Define updates by meaningful events and lead the final response with the outcome. |
| Unrequested cleanup or expanded scope | State the intended scope and stopping boundary explicitly. |
| Repeated checking or verifier agents | Remove generic re-check instructions; retain only task-specific proof of success. |
| Too many subagents | Define substantial delegation criteria and enforce a harness-level spawn cap. |
| Valid review findings are missed | Request broad discovery first, then filter or verify separately. |
| Written reports are padded | Set a document-specific length target and exclude filler and repeated summaries. |
| Tool calls or XML appear in visible output | Keep thinking enabled; otherwise lower effort, allow brief pre-tool text, and reject internal XML tags generally. |

## Sources

- Anthropic, [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
- Anthropic, [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- Anthropic, [Migration guide](https://platform.claude.com/docs/en/about-claude/models/migration-guide#migrating-to-claude-opus-5)
- Anthropic, [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
