# Prompting Poolside Laguna S 2.1

Laguna S 2.1 is Poolside's mid-size open-weight model for agentic coding and long-horizon work. This guide applies to `poolside/laguna-s-2.1` and separates model behavior from provider-specific serving controls.

## Model profile

- Best fit: difficult repository work, extended coding or research, repeated tool use, and tasks that must recover from failed approaches and keep validating progress.
- Context: the main checkpoint supports 1,048,576 tokens. Confirm the selected checkpoint and serving route's configured limit instead of assuming the full window is exposed.
- Reasoning: two modes only, off and max. Max is the default and lets the model choose its thinking budget; low, medium, and high effort levels are not available for this release.
- Thinking history: reasoning is interleaved between tool calls and works best when prior `reasoning_content` is preserved in assistant history.
- Tools: trained for agent harnesses, but known limitations include using a remembered tool interface instead of a slightly different schema and producing invalid JSON for nested or array-valued arguments.
- Modality: text input and output only. Supply textual tool results or machine-readable measurements for visual or runtime evidence.

## Give it a complete brief and a stopping rule

Poolside's prompting guidance recommends direct, specific, imperative requests with only relevant context. For S 2.1, also define the finish line. Its persistence is useful on hard work, but vague optimization or investigation goals can produce very long runs.

State the outcome, relevant paths, constraints, validation, allowed actions, and final report. For open-ended work, define a measurable threshold or a point at which the model should report that further progress is not justified.

```text
Reduce allocation churn in the streaming response path without changing its public API.
Inspect only the accumulator and trajectory-materialization code. Try one approach at
a time, run the existing benchmark after each change, and keep only measured wins.
Stop after two consecutive approaches fail to improve the result. Run the focused tests
and report the retained changes, benchmark delta, validation, and remaining uncertainty.
```

Avoid broad requests such as "improve this repository." Split unrelated goals into separate tasks. Name files, errors, tests, or reference material that establish a useful starting point, and remove stale context rather than relying on ambiguous references such as "this" or "the earlier version."

## Use max thinking for hard work, not every request

Use max thinking for debugging, long-horizon implementation, research, and decisions that need backtracking or sustained verification. Poolside reports large gains from max thinking on its long-horizon evaluations, but also documents unexpectedly long thinking sequences and overthinking. Turn thinking off for straightforward lookup, formatting, or small deterministic edits where the extra reasoning cannot improve the result.

Thinking is a runtime control. Do not simulate an effort ladder in the prompt. For complex work, a request to proceed in stages can improve the visible plan and progress reporting, but it does not replace enabling native thinking.

Preserve each returned reasoning block with its assistant message across a multi-step tool loop. Dropping it can cause follow-up steps to stop reasoning. Keep long runs grounded with a compact record of the goal, verified results, failed approaches, and next check; retain evidence, not a transcript of obsolete exploration.

## Make tool schemas authoritative and validate every call

Use short, literal tool descriptions with explicit parameter types, required fields, and examples only where the schema is easy to misread. Do not define a tool that closely resembles a common shell or edit tool while changing its argument names without making the difference prominent.

Validate the function name and arguments before execution. If the first call follows a remembered interface instead of the supplied schema, reject it and return the exact validation error; Poolside reports that an in-context retry usually corrects this. For nested objects and arrays, parse the JSON before dispatch and give the model the failing field rather than a generic tool error.

Bound retries and state the terminal condition. When the task depends on images or UI state, expose observable text through OCR, DOM inspection, accessibility output, headless-browser metrics, or another tool instead of implying that the model can see the artifact.

## Common failure modes

| Symptom | Response |
| --- | --- |
| The run keeps investigating or optimizing after gains become marginal | Add a measurable finish rule, failed-attempt budget, and required final report. |
| A tool call uses familiar but wrong argument names | Reject it with the exact schema mismatch and retry with the authoritative tool definition in context. |
| An edit or other nested argument contains invalid JSON | Parse before execution, identify the failing field or escape, and request one corrected call. |
| Follow-up tool steps stop reasoning | Preserve prior `reasoning_content` unchanged with the assistant messages. |
| A simple task spends too long thinking | Disable thinking instead of inventing a lower effort level. |
| Large context produces a drifting answer | Retrieve the relevant files first and maintain a short verified state summary. |
| The task assumes screenshot or video understanding | Convert the needed evidence into text or machine-readable tool output. |

## Sources

- Poolside, [Prompting best practices](https://docs.poolside.ai/resources/prompting-best-practices)
- Poolside, [Laguna S 2.1 model card](https://huggingface.co/poolside/Laguna-S-2.1)
- Poolside, [Introducing Laguna S 2.1](https://poolside.ai/blog/introducing-laguna-s-2-1)
- Poolside, [Model release notes](https://docs.poolside.ai/release-notes/models)
