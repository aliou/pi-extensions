# GPT-5.5 prompting guidelines

## Used by

- `oracle` primary
- `artisan` primary
- `reviewer` primary

## Guidance

Use outcome-first prompts. State the outcome, what good means, constraints, available evidence, verification signal, and desired final answer shape. Avoid prescribing a step-by-step process unless the exact process is part of the contract.

Give the model a checkable target. It is strong at executing a clear engineering ticket, but it can still complete the written task while missing unstated product intent. Avoid vague prompts such as “look into this”; say whether the expected output is diagnosis only, options and trade-offs, a recommendation, or an implementation plan.

Put durable behavior in tool descriptions, system prompts, and `AGENTS.md`, not repeated user prompts. Keep per-call prompts focused on the task-specific outcome and constraints.

Scale reasoning and verification to risk. `medium` is the balanced default for normal deep work. Use `low` for narrow tasks with cheap verification, and reserve `xhigh` for high-risk or quality-critical work. Do not assume higher reasoning is always better.

## Sources

- OpenAI, Prompt guidance: https://developers.openai.com/api/docs/guides/prompt-guidance
- OpenAI, Using GPT-5.5: https://developers.openai.com/api/docs/guides/latest-model
- OpenAI, Reasoning models: https://developers.openai.com/api/docs/guides/reasoning
- OpenAI Codex, Best practices: https://developers.openai.com/codex/learn/best-practices
- Amp, GPT-5.5 model card: https://ampcode.com/models/gpt-5.5
