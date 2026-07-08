# Claude Opus 4.8 prompting guidelines

## Used by

- `advisor` secondary model

## Guidance

Use explicit, literal instructions. Opus 4.8 follows scoped instructions closely, so prompts should say what the recommendation applies to and what to omit.

Constrain verbosity. Opus 4.8 calibrates response length to task complexity and can produce longer analysis for open-ended questions. Advisory prompts should ask for focused recommendations, concrete risks, and minimal background.

Prompt tool use when evidence matters. Opus 4.8 can prefer reasoning over tools, so tell it to inspect supplied files before making file-specific claims.

For review-like advisory calls, prioritize coverage of issues that could change the next action. Ask it to rank uncertainty or severity instead of silently filtering out moderate-confidence risks.

Use `xhigh` effort for Advisor calls that need difficult strategic judgment.

## Sources

- Anthropic, Prompting Claude Opus 4.8: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8
- Anthropic, What's new in Claude Opus 4.8: https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8
