# Prompting Gemma 4 31B

Gemma 4 31B is Google DeepMind's largest open-weight dense model in the Gemma 4 family. It takes text and image input, has a 256K-token context, native function calling, and a boolean thinking mode. This guide applies to the instruction-tuned variant (`gemma-4-31B-it`).

## Model profile

- Best fit: agentic tool loops, code investigation and generation, evidence-cited research, and image, document, and UI understanding. It is the strongest reasoning and coding size in the family.
- Context: 256K tokens. It leads the family on long-context retrieval (MRCR v2 8-needle 128k: 66.4%) but still degrades with distance; scope retrieval instead of dumping whole repositories.
- Reasoning: thinking is a boolean toggle, not an effort dial. Enable it by including the `<|think|>` token in the system turn; remove the token to disable. Most frameworks expose this as `enable_thinking`. Whether a deployment exposes the toggle is a serving decision: neuralwatt registers the model as `reasoning: false` (see `extensions/provider/models/public-models.ts` in pi-neuralwatt), so harness subagents run it without thinking.
- Sampling: use Google's standardized configuration across all use cases: `temperature=1.0`, `top_p=0.95`, `top_k=64`.
- Tools: native function calling trained into the chat format. Thinking improves calling accuracy: the model reasons privately about when to call and how to set parameters before emitting the call.
- Media: image input only at this size (no audio; the 31B carries a ~550M-parameter vision encoder). It posts the family's best document parsing (OmniDocBench 0.131 average edit distance) and strong UI and screen understanding.
- Benchmarks (instruction-tuned): MMLU Pro 85.2%, GPQA Diamond 84.3%, LiveCodeBench v6 80.0%, Codeforces ELO 2150, Tau2 tool use 76.9%, MMMU Pro 76.9%. Search tools lift it well beyond its parametric knowledge (HLE 19.5% without tools, 26.5% with search).

## Give it a bounded task contract

State the objective, scope, evidence standard, exclusions, and final deliverable. The 31B follows instructions closely, so the prompt carries the stopping condition.

```text
Trace why the cache key changes between identical requests.
Inspect only the key-derivation path and its callers. Cite file and line ranges for
every claim, say "not found" where the code cannot prove a step, and end with one
verified cause or a shortest list of candidates. Do not edit code.
```

For tool-augmented work, name the allowed tools, what each must establish, and the expected result shape. For analysis-only work, say the deliverable is evidence and recommendations and prohibit edits.

## Manage thinking explicitly

Thinking is conversation-level: consolidate the `<|think|>` token, system instructions, and tool declarations into a single system turn. Enable it for planning, debugging, multi-step analysis, and tool use; disable it for trivial lookup or transformation.

Mind the thought-history rules, which differ from other reasoning models:

- Strip generated thoughts from conversation history between standard turns. History should contain only the final answer from each previous model turn.
- Preserve thoughts inside a tool-call sequence. Within a single agentic turn that chains function calls, do not remove them.
- For long-running agents, summarize previous thoughts and feed them back as plain text. Gemma 4 strips raw thoughts between turns, so an unmodified loop can re-derive the same reasoning cyclically; summarized reasoning carries the thread forward. Any summary format works.

On the 12B, 26B A4B, and 31B sizes, a thinking-off prompt still emits an empty `<|channel>thought` block. The official chat template inserts this empty block on purpose to suppress "ghost" thought channels; do not treat it as a malfunction or hand-edit it away.

Thinking depth is steerable through system instructions. Google's testing shows an instruction to think efficiently at lower depth cuts thinking tokens by roughly 20%. This is a byproduct of instruction following, not a trained control, so tune the wording per workload and measure.

## Tool loops

Declare tools with explicit JSON schemas. Auto-generated schemas reduce complex nested parameters to a generic "object" without inner properties; write nested properties out by hand so the model can populate them. Keep descriptions precise and enum values exhaustive.

Validate function names and arguments before executing anything the model emits. Give the loop a terminal condition and a retry budget so a missing result does not become unbounded exploration.

Keep thinking enabled inside tool loops. The model uses its thought channel to decide when to call and how to fill parameters, and those thoughts must survive between the calls of a single turn.

## Use images as evidence

Place image content before text in the prompt. State what to inspect and what to ignore, and ask for exact visible evidence — text, layout, hierarchy, affordances, error output — separated from interpretation.

Image detail is configurable through a visual token budget of 70, 140, 280, 560, or 1120 tokens per image. Use low budgets for classification, captioning, and many-frame video; use high budgets for OCR, document parsing, and small text. Video is processed as frames, up to 60 seconds at one frame per second.

## Common failure modes

| Symptom | Response |
| --- | --- |
| Cyclical reasoning across a long agent run | Summarize prior thoughts back into context as plain text; raw thoughts are stripped between turns. |
| Degraded tool-chain continuity | Preserve thoughts within the tool-call sequence of a single turn. |
| "Ghost" thought channels with thinking off | Use the official chat template, which inserts an empty thought block on 12B/26B/31B; do not strip it. |
| Malformed or shallow arguments for nested parameters | Hand-write the JSON schema with explicit nested properties instead of relying on auto-generation. |
| Excessive thinking cost on simple steps | Disable thinking, or add a system instruction to think at lower depth and measure the savings. |
| Long-context misses | Retrieve relevant files first and keep a verified state summary; do not treat 256K as a substitute for scoping. |
| Small text or dense documents misread | Raise the visual token budget toward 1120. |

## Sources

- Google AI for Developers, [Gemma 4 prompt formatting](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4)
- Google AI for Developers, [thinking mode in Gemma](https://ai.google.dev/gemma/docs/capabilities/thinking)
- Google AI for Developers, [function calling with Gemma 4](https://ai.google.dev/gemma/docs/capabilities/text/function-calling-gemma4)
- Google AI for Developers, [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4)
- Google AI for Developers, [Gemma 4 model overview](https://ai.google.dev/gemma/docs/core)
- Google AI for Developers, [Gemma basic text inference](https://ai.google.dev/gemma/docs/capabilities/text/basic)
