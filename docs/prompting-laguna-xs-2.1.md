# Prompting Poolside Laguna XS 2.1

Laguna XS 2.1 is Poolside's compact open-weight model for fast agentic coding and local use. This guide applies to `poolside/laguna-xs-2.1`, where speed and a tight task boundary matter more than broad autonomous ownership.

## Model profile

- Best fit: well-scoped coding changes, rapid investigation and iteration, multilingual software work, terminal tasks, and low-cost tool loops.
- Context: 262,144 tokens. Use the window for selected code and current task state rather than an unscoped repository dump.
- Reasoning: native interleaved thinking can be enabled or disabled per request. The official model card recommends enabling it for agentic coding.
- Thinking history: preserve prior reasoning content with assistant messages. Reconstructed histories that drop it may produce no reasoning on later tool steps.
- Tools: supports tool calling through the Laguna chat template and compatible parsers. A known older-vLLM parser bug can drop calls or leak raw tool markup.
- Modality: text input and output only; it does not inspect images or video.

## Give it one bounded job

Use direct, imperative instructions. State the expected result, relevant files or errors, constraints, validation, and response shape. Poolside recommends breaking large or ambiguous work into smaller, well-specified prompts and minimizing unrelated context.

```text
Fix the retry loop in src/client/request.ts so a 429 honors Retry-After before
exponential backoff. Preserve the existing public API and do not refactor the transport.
Add a focused regression test, run the client test file, and report changed files and
the command result. If the current tests cannot reproduce the behavior, stop and report
the missing seam instead of redesigning the client.
```

For analysis-only work, say not to edit. For implementation, name the smallest allowed scope and the exact check that proves completion. If the task spans independent subsystems or requires broad architectural judgment, split it into evidence-producing stages or use a larger model such as Laguna S 2.1.

Start a fresh conversation when previous files, assumptions, or proposed edits no longer match the workspace. Avoid references such as "fix that" when several prior turns could be the target.

## Enable thinking only when the task benefits

Enable thinking for debugging, planning, multi-constraint edits, and multi-step tool use. Disable it for simple retrieval, formatting, or deterministic transformations. The model card documents an on/off control through `enable_thinking`; do not assume that every hosted route exposes a low-to-high effort ladder just because a generic API accepts a `reasoning` field.

Preserve returned reasoning content unchanged and in order during tool loops. Give the loop a retry budget and stopping condition, and return exact command output or validation errors so the model can correct the next step.

For self-hosted evaluation-like runs, Poolside used `temperature=1.0`, `top_k=20`, and `top_p=1` with thinking enabled. Treat this as a reproducibility baseline, not a universal production setting; hosted providers may fix, ignore, or override sampling controls.

## Keep tool and serving failures separate

Define tools with precise names, descriptions, JSON schemas, and required fields. Validate calls before executing them and return concise, structured results. Include the tools again on follow-up requests when the serving API requires it.

If a tool call disappears or raw `<tool_call>` markup reaches the assistant response, fix the serving stack rather than adding prompt workarounds. Poolside's model card requires a vLLM build containing its parser fix; on older builds it recommends the `glm47` parser instead of `poolside_v1`. Confirm the correct reasoning and tool parser for the chosen runtime because flag names differ across vLLM, SGLang, and TensorRT-LLM.

For UI or other visual work, provide DOM, accessibility, OCR, logs, or measurements as text. Do not ask the model to infer unseen state from an image it cannot process.

## Common failure modes

| Symptom | Response |
| --- | --- |
| A broad task produces shallow or partial work | Split it into bounded stages with one result and validation check each. |
| Later tool steps stop emitting reasoning | Preserve prior reasoning content with the original assistant messages. |
| Raw tool-call tags appear or calls vanish | Update the runtime/parser or use Poolside's documented fallback; do not prompt around it. |
| A trivial request has avoidable latency | Disable thinking and keep the requested output small. |
| The model follows stale code from earlier turns | Start a fresh conversation with current files and explicit references. |
| Results vary from Poolside's published evaluations | Match the documented sampling and harness setup before attributing the difference to prompting. |
| The task expects visual inspection | Supply textual or machine-readable evidence through a tool. |

## Sources

- Poolside, [Prompting best practices](https://docs.poolside.ai/resources/prompting-best-practices)
- Poolside, [Laguna XS 2.1 model card](https://huggingface.co/poolside/Laguna-XS-2.1)
- Poolside, [Introducing Laguna XS 2.1](https://poolside.ai/blog/introducing-laguna-xs-2-1)
- Poolside, [Supported models](https://docs.poolside.ai/get-started/supported-models)
- NVIDIA, [Laguna XS 2.1 model card](https://docs.api.nvidia.com/nim/reference/poolside-laguna-xs-2-1)
