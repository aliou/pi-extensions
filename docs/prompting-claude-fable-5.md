# Claude Fable 5 prompting guidelines

## Used by

- `advisor` primary

## Guidance

Use brief, goal-and-boundary prompts. Fable 5 follows instructions strongly and performs well on ambiguous, long-horizon, multi-threaded work, so prompts should state the desired outcome, evidence, constraints, and stopping boundary rather than a long procedure.

Keep advisory prompts decisive. Tell the model to recommend one path when enough information is available, avoid re-deriving established facts, and avoid surveying options it will not choose.

Ground claims in evidence. For long or tool-heavy work, instruct the model to distinguish verified facts from assumptions and to say plainly when something is unverified.

Avoid reasoning-extraction language. Do not ask Fable 5 to reveal private reasoning, show chain-of-thought, or reproduce internal thinking. Ask for conclusions, concise rationale, evidence, and next checks instead.

Use `high` effort as the default for Advisor. Reserve higher effort for exceptionally high-risk calls; Fable 5 can over-deliberate on routine work if prompts are too broad.

## Sources

- Anthropic, Prompting Claude Fable 5: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5
- Anthropic, Introducing Claude Fable 5 and Claude Mythos 5: https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5
