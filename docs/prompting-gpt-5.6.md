# Prompting GPT-5.6

GPT-5.6 is a newer GPT-5 family with a Sol, Terra, and Luna size range. Tune the chosen variant and runtime configuration against representative work; do not assume a prompt optimized for GPT-5.5 transfers unchanged.

## Model profile

- Best fit: Sol for complex, open-ended, high-value work; Terra for everyday multi-step work that needs judgment; Luna for clear, well-scoped, high-volume work. Select the variant before compensating with prompt complexity.
- Behavioral profile: proactive and compressed by default. It benefits from a small, precise task contract and explicit permission boundaries.
- Reasoning: configure effort in the API rather than asking for visible reasoning. Begin at the corresponding GPT-5.5 effort level, then compare that level and one level lower.
- Context and caching: preserve a stable prompt prefix where possible. GPT-5.6 introduces explicit cache breakpoints and a minimum 30-minute cache life; use these in integration design, not task prose.

The public model family was in limited preview at publication time. Reconfirm model IDs, availability, supported parameters, and safety behavior against OpenAI documentation before production changes.

## Use a compact, outcome-first task contract

State the result needed before prescribing a routine process. Include the goal, relevant context, ready-to-use output, one or two material boundaries, verification condition, autonomy boundary, and final answer shape. Name the audience or intended use when it changes the structure, detail, or tone.

For each supplied or connected source, say what it should contribute. Require retrieval for current information and ask for source anchors when the result must be checked. Do not add irrelevant context or enumerate every search the model should perform.

```text
Find the cause of the desktop startup regression after workspace indexing changed.
Use existing profiling hooks where possible. Keep measurements local and remove them.
Report evidence, smallest safe fix, and validation. Implement only if the change is
localized; otherwise stop after the diagnosis and plan.
```

Keep system and user instructions minimal but complete. Accumulated rules, redundant examples, and generic boilerplate can dilute the important requirements. Add examples only when evaluation exposes a specific failure. Specify a process only when it is part of the product contract or protects a material invariant; otherwise leave the model room to choose its approach.

Do not counter its naturally concise answers with generic "be brief" instructions. Instead prioritize: lead with the conclusion; retain evidence, required caveats, and decision-relevant detail; remove repetition and optional background first.

## Make autonomy and safety boundaries explicit

GPT-5.6 can continue work proactively. Say whether it should give advice only, plan, make local edits, run validation, modify infrastructure, write externally, or seek approval. Define destructive actions, publication, deployments, data deletion, and scope expansion as explicit checkpoints.

For sensitive dual-use work, describe the legitimate context, authorization, allowed boundaries, and safe intended outcome. Do not use ambiguous wording that makes a defensive task resemble offensive misuse.

When the task is underspecified, state whether it should make the simplest valid assumption, provide labeled interpretations, or ask a small number of targeted questions. Do not leave this policy implicit. For important outputs, request a final check tailored to the task, such as confirming required fields, reconciling related deliverables, or flagging unverified information.

## Reasoning, tools, and long runs

Reasoning effort is a runtime trade-off, not prompt text. The GPT-5.6 Codex guidance identifies these useful model-and-effort pairings:

| Codex level | Best fit |
| --- | --- |
| Sol Medium | Default starting point for difficult work. |
| Terra High | Understood implementation or review work with meaningful complexity. |
| Luna xHigh | Well-scoped implementation where speed matters. |
| Sol Ultra | High-stakes work with scattered context, substantial ambiguity, or a need for proactive multi-agent coordination. |

The post's rule of thumb is to increase effort as models get smaller: Sol Medium, Terra High, and Luna xHigh are comparable starting points for the same class of task. Ultra is not a routine default; reserve it for work where maximum reasoning and coordination justify the extra tokens.

Codex labels such as `Ultra` are product-level terms, not this repository's `thinking` enum. Keep the provider-supported configuration values (such as `medium`, `high`, and `xhigh`) in code; do not invent `thinking: "ultra"`. For all models, start at the smallest effort that meets the finish line and raise it only when representative evaluation shows a material gain.

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
- OpenAI, [Prompting overview](https://learn.chatgpt.com/docs/prompting)
- OpenAI, [Previewing GPT-5.6 Sol](https://openai.com/index/gpt-5-6/)
- Peter V., [Choosing GPT-5.6 Sol, Terra, or Luna in Codex](https://x.com/pvncher/status/2077708372363624894)
- Simon Willison, [The new GPT-5.6 family: Luna, Terra, Sol](https://simonwillison.net/2026/Jul/9/gpt-5-6/)
