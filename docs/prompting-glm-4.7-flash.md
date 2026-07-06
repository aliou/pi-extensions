# GLM-4.7-Flash prompting guidelines

## Used by

- `read_session` primary

## Guidance

Use narrow extraction prompts. Provide the session ID or path plus a specific goal that names the decisions, files, commands, dates, projects, people, or tool calls to extract.

Specify the output shape. Good goals ask for concrete fields such as final decision, files changed, commands run, unresolved questions, or cited evidence. Avoid generic “summarize this” prompts when exact extraction is needed.

Ask it to separate evidence from inference. For exact facts, request cited session evidence and ask for `not found` when the session does not contain the requested information.

Keep the task bounded. GLM-4.7-Flash is lightweight and fast, with strong enough context for session extraction, but it should not be used as a general codebase researcher or broad conversation analyst.

## Sources

- Z.ai, GLM-4.7 overview and GLM-4.7-Flash details: https://docs.z.ai/guides/llm/glm-4.7?id=GLM4.7Flash
- Z.ai, Thinking mode: https://docs.z.ai/guides/capabilities/thinking-mode
- Z.ai, Core parameters: https://docs.z.ai/guides/overview/concept-param
