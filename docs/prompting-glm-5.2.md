# GLM-5.2 prompting guidelines

## Used by

- `scout` primary and fallback family
- `librarian` primary and fallback family
- `oracle` fallback
- `reviewer` fallback
- `read_session` fallback family through `glm-5.2-short-fast`

## Guidance

Use narrow, explicit research prompts. State the exact project, repository, symbol, feature, behavior, or session fact to trace. Include relevant roots, paths, versions, constraints, what to ignore, and the desired output shape.

Ask for evidence. For codebase research, request cited files and line ranges. For architecture questions, request a compact map of modules, responsibilities, call paths, data flow, constraints, and verified gaps. For extraction tasks, ask for `not found` when evidence is missing rather than inferred facts.

Use the large context deliberately. GLM-5.2 is built for long-horizon and project-scale coding work, but broad prompts still waste context and increase drift. Prefer bounded questions over open-ended requests like “understand this repo”.

Match reasoning to the task. GLM-5.2 supports deep thinking and `reasoning_effort`; `low` and `medium` compatibility values map upward in Z.ai’s API. Keep prompts clear about boundaries, verification, and stop conditions so long-context work does not expand beyond scope.

## Sources

- Z.ai, GLM-5.2 overview: https://docs.z.ai/guides/llm/glm-5.2
- Z.ai, Migrate to GLM-5.2: https://docs.z.ai/guides/overview/migrate-to-glm-new
- Z.ai, Core parameters: https://docs.z.ai/guides/overview/concept-param
- Z.ai, Deep thinking: https://docs.z.ai/guides/capabilities/thinking
- Z.ai, Thinking mode: https://docs.z.ai/guides/capabilities/thinking-mode
