# Kimi K2.7 Code prompting guidelines

## Used by

- `look_at` primary and fallback family
- `artisan` fallback for screenshot-heavy design work

## Guidance

Use precise multimodal objectives. State what visible evidence to inspect, what to ignore, the relevant product/code/error context, and the desired output format.

Ground answers in observable evidence. For screenshots, diagrams, charts, and error images, ask for exact visible text, layout, hierarchy, components, spacing, colors, relationships, and error messages. Do not ask it to infer hidden state beyond the image.

For UI screenshots, ask for concrete observations and implementable recommendations: visual hierarchy, readability, affordances, accessibility, focus/keyboard concerns, responsive issues, and visible copy.

Do not tune sampling parameters in prompts or wrappers unless the provider requires it. Kimi K2.7 Code is a thinking model with fixed sampling behavior in the official API; the important prompt lever is a clear visual objective and evidence contract.

## Sources

- Moonshot, Kimi K2.7 Code quickstart: https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart
- Moonshot, Use the Kimi Vision Model: https://platform.kimi.ai/docs/guide/use-kimi-vision-model
- Moonshot, Using Thinking Models: https://platform.kimi.ai/docs/guide/use-kimi-k2-thinking-model
- Moonshot, Model list: https://platform.kimi.ai/docs/models
- Hugging Face, Kimi K2.7 Code model card: https://huggingface.co/moonshotai/Kimi-K2.7-Code
