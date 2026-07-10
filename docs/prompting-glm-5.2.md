# Prompting GLM-5.2

GLM-5.2 is Z.ai's open-weight, text-only model for long-horizon agentic engineering. Its 1M-token context, tool use, structured output, and deep-thinking controls suit large, evidence-led tasks, but a strong prompt still bounds the question and verification contract.

## Model profile

- Best fit: repository-scale investigation, long-running coding, multi-tool research, deep debugging, extraction, and structured analysis.
- Context: 1M tokens. Use it to retain relevant evidence and task state, not to replace retrieval, indexing, or scope control.
- Reasoning: thinking is enabled by default. `reasoning_effort` supports `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`; Z.ai documents `max` as the default and recommends it for deep reasoning. `low` and `medium` map upward to `high`; `xhigh` maps to `max`.
- Tool use: interleaved thinking is default. Preserved thinking is available for coding/agent workloads; return historical `reasoning_content` unchanged when it is enabled.

Simon Willison's assessment of the open weights emphasizes its scale and long-context capacity. Scale is useful only after the task identifies the required evidence, output, and stopping point.

## Define a research or implementation contract

Start with the exact behavior, symbols, roots, versions, evidence standard, exclusions, and final artifact. Good long-horizon prompts make the stopping boundary as clear as the starting question.

```text
Trace why workers can restart without clients redoing their handshake.
Inspect the client handshake and worker lifecycle only. Cite files and symbols for the
verified failure path. Propose two or three fixes with compatibility and recovery
trade-offs; do not edit code. Say "not found" for any claim the repository cannot prove.
```

For implementation, state the expected behavior, excluded refactors, validation command, and permission boundaries. For research, require source citations, an evidence/inference distinction, and a compact architecture map when relevant: modules, responsibilities, data flow, constraints, and verified gaps.

Do not ask it to "understand this repository." Break large work into questions with measurable deliverables, then synthesize only the verified outputs.

## Tune thinking before adding prompt ceremony

Use thinking for planning, debugging, multi-step analysis, and decisions with meaningful trade-offs. Disable it for trivial lookup, simple transformation, or low-risk classification. Because several nominal effort values map to a smaller set of actual levels, measure latency and quality on real workloads rather than assuming the name describes a unique setting.

Use `max` or `xhigh` when complex work merits the cost; use `high` for many substantial tasks. Preserve the model's reasoning continuity in tool loops by returning the full, original `reasoning_content` in its original order. Do not ask it to recreate or rewrite that content.

## Tool loops and long context

Tell the model which tools are allowed, what each must establish, what result shape to return, and when to stop. Parallelize independent scans; sequence tools when a later search depends on earlier evidence. Require exact source locations for code claims.

For a long tool loop, keep a short external state record with the objective, verified decisions, open questions, and next test. Use retrieval to focus the 1M-token window. Compact or summarize only verified state; do not carry forward speculative conclusions as facts.

Use structured output for extraction and orchestration interfaces. Define required fields, optional fields, allowed values, and a missing-data representation. Validate tool arguments and external results at boundaries; do not add defensive scaffolding inside trusted local code without a reason.

## Common failure modes

| Symptom | Response |
| --- | --- |
| Broad, drifting repository analysis | Divide the task into bounded questions with exact evidence and output requirements. |
| Confident but unverified architecture claim | Require path/symbol citations and an explicit `not found` outcome. |
| Excessive reasoning cost | Disable thinking for trivial steps or move to the lowest measured effective effort. |
| Multi-turn tool work loses consistency | Use preserved thinking and return unmodified historical reasoning blocks. |
| Oversized context hides key facts | Retrieve relevant files first and maintain a verified state summary. |

## Sources

- Z.ai, [GLM-5.2 overview](https://docs.z.ai/guides/llm/glm-5.2)
- Z.ai, [Deep thinking](https://docs.z.ai/guides/capabilities/thinking)
- Z.ai, [Thinking mode](https://docs.z.ai/guides/capabilities/thinking-mode)
- Z.ai, [Models overview](https://docs.z.ai/guides/overview/overview)
- Simon Willison, [GLM-5.2 is probably the most powerful text-only open weights LLM](https://simonwillison.net/2026/Jun/17/glm-52/)
- Amp, [model selection and GLM-5.2 deployment](https://ampcode.com/models)
