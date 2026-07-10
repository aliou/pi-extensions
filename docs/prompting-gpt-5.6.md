# Prompting GPT-5.6

GPT-5.6 is a newer GPT-5 family with a Sol, Terra, and Luna size range. Tune the chosen variant and runtime configuration against representative work; do not assume a prompt optimized for GPT-5.5 transfers unchanged.

## Model profile

- Best fit: Sol for the most demanding coding and professional work, Terra for balanced daily work, and Luna for fast, lower-cost tasks. Select the variant before compensating with prompt complexity.
- Behavioral profile: proactive and compressed by default. It benefits from a small, precise task contract and explicit permission boundaries.
- Reasoning: configure effort in the API rather than asking for visible reasoning. Begin at the corresponding GPT-5.5 effort level, then compare that level and one level lower.
- Context and caching: preserve a stable prompt prefix where possible. GPT-5.6 introduces explicit cache breakpoints and a minimum 30-minute cache life; use these in integration design, not task prose.

The public model family was in limited preview at publication time. Reconfirm model IDs, availability, supported parameters, and safety behavior against OpenAI documentation before production changes.

## Use a compact, testable task contract

Give the model a direct target rather than an open-ended request. Include the outcome, constraints, available evidence, verification condition, autonomy boundary, and final answer shape.

```text
Find the cause of the desktop startup regression after workspace indexing changed.
Use existing profiling hooks where possible. Keep measurements local and remove them.
Report evidence, smallest safe fix, and validation. Implement only if the change is
localized; otherwise stop after the diagnosis and plan.
```

Keep system and user instructions minimal but complete. Accumulated rules, redundant examples, and generic boilerplate can dilute the important requirements. Add examples only when evaluation exposes a specific failure.

Do not counter its naturally concise answers with generic "be brief" instructions. Instead prioritize: lead with the conclusion; retain evidence, required caveats, and decision-relevant detail; remove repetition and optional background first.

## Make autonomy and safety boundaries explicit

GPT-5.6 can continue work proactively. Say whether it should give advice only, plan, make local edits, run validation, modify infrastructure, write externally, or seek approval. Define destructive actions, publication, deployments, data deletion, and scope expansion as explicit checkpoints.

For sensitive dual-use work, describe the legitimate context, authorization, allowed boundaries, and safe intended outcome. Do not use ambiguous wording that makes a defensive task resemble offensive misuse.

When the task is underspecified, state whether it should make the simplest valid assumption, provide labeled interpretations, or ask a small number of targeted questions. Do not leave this policy implicit.

## Reasoning, tools, and long runs

Reasoning effort is a runtime trade-off, not prompt text. Use `low` for latency-sensitive or cheaply verified work; use `medium` as a general baseline; increase to `high` or `xhigh` only when evaluation proves a quality gain; reserve `max` for exceptional quality-first work.

For tool-heavy workflows, define the stage, allowed tools, result schema, retry limit, stop condition, and handoff. Use direct tool calls when the next action depends on fresh model judgement, approval, or native artifacts. Use programmatic tool calling when code can reliably filter, join, rank, aggregate, deduplicate, or validate bulky tool output before returning a smaller result to the model.

Require fresh evidence for current, repository-specific, and user-specific claims. Parallelize genuinely independent reads. Make final validation proportional to risk and report failed checks directly.

## Common failure modes

| Symptom | Response |
| --- | --- |
| Important details omitted from an over-compressed answer | Replace generic brevity with an explicit required answer shape. |
| Work continues beyond user intent | State implementation, external-write, and scope-expansion permissions. |
| Prompt becomes brittle after migration | Rebuild a minimal baseline and add constraints only after measured regressions. |
| Tool loop is expensive or unfocused | Define stages, outputs, retries, stopping, and whether tools are direct or programmatic. |
| The model acts on a stale or ambiguous fact | Require retrieval, cite evidence, and define the missing-information behavior. |

## Sources

- OpenAI, [Using GPT-5.6](https://developers.openai.com/api/docs/guides/latest-model)
- OpenAI, [Reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices)
- OpenAI, [Programmatic tool calling](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling)
- OpenAI, [Previewing GPT-5.6 Sol](https://openai.com/index/gpt-5-6/)
- Simon Willison, [The new GPT-5.6 family: Luna, Terra, Sol](https://simonwillison.net/2026/Jul/9/gpt-5-6/)
