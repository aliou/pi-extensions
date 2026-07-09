# GPT-5.6 prompting guidelines

## Guidance

Use the same outcome-first shape as GPT-5.5. State the desired outcome, constraints, available evidence, verification signal, and final answer shape. Give the model a checkable target instead of a vague request.

Keep prompts short. GPT-5.6 is sensitive to accumulated prompt cruft and usually benefits from minimal task-specific instructions, concise tool descriptions, and fewer examples. Add examples or extra rules only when evaluations show a specific gap.

Avoid generic brevity instructions such as “be concise,” “keep it short,” or “use minimal text.” GPT-5.6 is already biased toward compressed answers, and broad brevity rules can cause it to omit required details. Prefer priority-based wording: lead with the conclusion, keep required evidence and caveats, and trim repetition or optional background first.

Define autonomy and permission boundaries clearly. GPT-5.6 is proactive and persistent, so prompts should distinguish read-only advice, planning, local implementation, validation, destructive actions, external writes, and scope expansion. Keep this boundary compact and explicit rather than repeating approval rules throughout the prompt.

Tune reasoning as a runtime parameter, not as prompt text. Start from the GPT-5.5 reasoning effort used for the same workload, then test the same level and one level lower. Use `medium` as the balanced baseline, `low` for latency-sensitive work, `high` or `xhigh` when measured quality improves, and `max` only for the hardest quality-first tasks.

Prompt for the task, not the mode. Do not ask the model to “use pro mode,” “think harder,” or produce hidden reasoning. Configure `reasoning.mode`, `reasoning.effort`, persisted reasoning, and cache behavior in the API. Ask for conclusions, evidence, assumptions, caveats, and next checks.

For tool-heavy workflows, make routing explicit. Programmatic Tool Calling is useful for bounded stages where code can filter, join, rank, deduplicate, aggregate, or validate tool outputs before returning a smaller structured result. Direct tool calls are better when each result needs fresh model judgment, approval, final citation validation, or native artifact preservation.

When both direct and programmatic tool calling are available, name the stage that should use each route, the allowed tools, the exact result shape, retry limits, stopping condition, and handoff point. Do not rely on generic guidance like “use tools efficiently.”

Account for GPT-5.6 safety behavior in prompts for dual-use domains. Legitimate cybersecurity, biology, or other sensitive work should state the authorized defensive context, boundaries, and intended safe outcome. Avoid ambiguous phrasing that could look like offensive misuse.

## Sources

- OpenAI, Using GPT-5.6: https://developers.openai.com/api/docs/guides/latest-model
- OpenAI, Reasoning best practices: https://developers.openai.com/api/docs/guides/reasoning-best-practices
- OpenAI, Programmatic Tool Calling: https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling
- OpenAI, GPT-5.6 release: https://openai.com/index/gpt-5-6/
