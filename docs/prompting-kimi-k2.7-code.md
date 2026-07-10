# Prompting Kimi K2.7 Code

Kimi K2.7 Code is Moonshot AI's coding-focused, multimodal agentic model. It is optimized for long-horizon software work, supports text, image, and video input, and always uses thinking with preserved thinking. This guide applies to the model itself, not a particular visual or coding subagent.

## Model profile

- Best fit: complex software engineering, codebase changes, multi-step tool loops, technical visual inspection, and long-context tasks with an explicit implementation or analysis target.
- Context: 256K tokens. It is large enough for sustained repository work but should still be fed an evidence path and a bounded objective.
- Reasoning: thinking and preserved thinking are mandatory. Non-thinking mode is unsupported.
- Sampling: do not set `temperature`, `top_p`, `n`, presence penalty, or frequency penalty; the official API fixes these values and errors on other values.
- Tools: only `tool_choice: "auto"` or `"none"` are supported. Multi-step tool calls require the assistant's `reasoning_content` to remain in the conversation unchanged.
- Media: supports image and video input. For official API requests, use base64 image/video content or uploaded files; URL-formatted image input is not supported. Moonshot recommends images no larger than 4K and video no larger than FHD because larger media increases cost and time without improving understanding.

## Give the model a complete engineering brief

State the goal, why it matters, relevant paths or media, invariants, excluded work, acceptance checks, and final deliverable. K2.7 Code is effective across long trajectories when it has a stable target; do not substitute a vague request for a plan.

```text
Fix the keyboard focus regression in the thread picker.
Inspect the focus lifecycle and the picker mount sequence. Preserve existing shortcuts
and do not rewrite the application shell. Add a focused regression test, run the
relevant checks, and report changed files, validation, and any remaining uncertainty.
```

For analysis-only work, say that the deliverable is evidence and recommendations, and prohibit code changes. For implementation, define the smallest allowed change, external-write permissions, and the expected validation. Ask for source paths, exact visible evidence, or tool output rather than broad assurances.

## Preserve reasoning and manage the tool loop correctly

K2.7 Code always emits `reasoning_content`. In every multi-turn interaction, include each historical assistant message with its original reasoning content, in order and without editing. Append the returned assistant message directly when possible. Omitting it, truncating it, or rebuilding it from a summary degrades continuity and can cause API errors.

Use streaming for long responses. Set `max_tokens` to include both reasoning and visible content; Moonshot recommends at least 16K for multi-step tool calls. Keep tool descriptions precise and return tool results in the expected format. Give the loop a retry budget and terminal condition so that a missing result does not become unbounded exploration.

```text
Use the screenshot and source files as evidence. List visible observations before
recommendations. Do not infer hidden state from the image. For each recommendation,
identify the UI element, user impact, and the code or design token most likely to own it.
```

## Use multimodal input as observable evidence

For screenshots, diagrams, video, charts, and error captures, specify what to inspect and what to ignore. Ask for exact text, component relationships, layout, hierarchy, affordances, contrast, spacing, focus state, or error output as appropriate. Separate observations from interpretation.

For UI evaluation, request implementable findings: visual hierarchy, readability, interaction cues, keyboard and focus concerns, responsive constraints, and consistency with the existing design system. Do not ask the model to derive inaccessible state, API behavior, or unseen source details solely from pixels; give it code or tools when those facts matter.

## Common failure modes

| Symptom | Response |
| --- | --- |
| API error or degraded multi-turn reasoning | Preserve every `reasoning_content` block unchanged and use only supported tool-choice values. |
| Excessive output or latency for a small task | Use a smaller task scope or model; K2.7 Code cannot disable thinking. |
| Tool calls lose the task thread | Keep original assistant turns, bound retries, and restate the acceptance condition after major milestones. |
| Visual advice invents hidden behavior | Ask for visible observations first and supply source/tool evidence for hidden state. |
| Sampling-parameter API errors | Omit unsupported sampling parameters and use the provider defaults. |
| Large media is slow or costly | Resize to the recommended 4K image/FHD video limits and upload reusable media once. |

## Sources

- Moonshot AI, [Kimi K2.7 Code quickstart and API behavior](https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart)
- Moonshot AI, [thinking-mode configuration](https://platform.kimi.ai/docs/guide/use-kimi-k2-thinking-model)
- Moonshot AI, [Kimi K2.7 Code model card](https://huggingface.co/moonshotai/Kimi-K2.7-Code)
- Moonshot AI, [Kimi K2.7 Code overview](https://www.kimi.com/resources/kimi-k2-7-code)
