import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineSubagent } from "@harness/agent-kit";
import type { SubagentModel } from "@harness/agent-kit/types";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { referencesImageFiles } from "./utils";

const MODEL_CANDIDATES: SubagentModel[] = [
  {
    provider: "neuralwatt",
    model: "kimi-k2.5-fast",
    thinking: "off",
    weight: 1,
  },
  {
    provider: "neuralwatt",
    model: "kimi-k2.6-fast",
    thinking: "off",
    weight: 1,
  },
  {
    provider: "neuralwatt",
    model: "qwen3.6-35b-fast",
    thinking: "off",
    weight: 1,
  },
  {
    provider: "synthetic",
    model: "moonshotai/Kimi-K2.6",
    thinking: "off",
    weight: 1,
  },
  {
    provider: "openai-codex",
    model: "gpt-5.3-codex-spark",
    thinking: "off",
    weight: 1,
  },
];

const ANALYSIS_SYSTEM_PROMPT = `You are an AI assistant that analyzes images for a software engineer.

# Core Principles

- Be concise and direct. Minimize output while maintaining accuracy.
- Focus only on the user's objective. Do not add tangential information.
- No preamble, disclaimers, or summaries unless specifically relevant.
- Never start with flattery ("great question", "interesting file", etc.).
- A wrong answer is worse than no answer. When uncertain, say so.

# Precision Guidelines

- Describe exactly what you see. Do not guess or infer beyond what is visible.
- When analyzing code screenshots: reference specific line numbers and symbols.
- When analyzing UI: describe layout, components, text, colors, and hierarchy.
- When analyzing errors: extract the exact error message, stack trace, and root cause.
- When analyzing diagrams: describe nodes, relationships, labels, and flow.

# Output Format

- Use GitHub-flavored Markdown.
- Use code fences with language tags for code snippets.
- No emojis or decorative symbols.
- Keep responses focused and brief.`;

const NUDGE_TEXT =
  "\n\nNote: the current model cannot see images. Use look_at to analyze any image files referenced above.";

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

const LookAtParams = Type.Object({
  path: Type.String({
    description: "Path to the image file to analyze (relative or absolute).",
  }),
  objective: Type.String({
    description:
      "What you want to learn from this image (e.g., 'describe the UI layout', 'extract the error message', 'read the text in this diagram').",
  }),
  context: Type.Optional(
    Type.String({
      description:
        "Broader context for why you need this analysis. Helps the vision model focus on what matters.",
    }),
  ),
});

function mimeTypeFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_TO_MIME[ext] ?? null;
}

export default function lookAt(pi: ExtensionAPI): void {
  const subagent = defineSubagent(pi, {
    name: "look_at",
    label: "Look At",
    description: `Analyze an image file using a vision-capable model. Returns a text description of the image content.

Use this tool when you need to understand or extract information from an image file (PNG, JPG, GIF, WebP, etc.). The current model cannot see images directly -- this tool delegates to a vision model that can.

Always provide a clear objective describing what you want to learn from the image.

## When to use this tool
- Analyzing screenshots, diagrams, charts, or photographs
- Extracting text or error messages from images
- Describing visual content that the Read tool cannot interpret
- Comparing visual elements (use context to describe what to compare)

## When NOT to use this tool
- For source code or plain text files where you need exact contents -- use read instead
- When you need to edit the file afterward
- For simple file reading where no interpretation is needed`,
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    tools: [],
    models: MODEL_CANDIDATES,
    parameters: LookAtParams,
    buildPrompt(params, ctx) {
      const absolutePath = resolve(ctx.cwd, params.path);
      const mimeType = mimeTypeFromPath(absolutePath);
      if (!mimeType)
        throw new Error(`Unsupported image format for ${absolutePath}`);

      const buffer = readFileSync(absolutePath);
      const userText = params.context
        ? `Context: ${params.context}\n\nObjective: ${params.objective}`
        : params.objective;

      return {
        text: userText,
        images: [
          {
            type: "image" as const,
            data: buffer.toString("base64"),
            mimeType,
          },
        ],
      };
    },
  });

  subagent.subscribe(pi);
  pi.registerTool(subagent.tool);
  pi.registerTool(subagent.resumeTool);

  pi.on("input", (event, ctx) => {
    const warn = (message: string) =>
      ctx.ui.notify(`[look_at] ${message}`, "warning");
    const model = ctx.model;
    if (!model) return;

    const modelHasVision = model.input.includes("image");

    if (modelHasVision) {
      warn("Model with vision called `look_at` tool.");
      return;
    }

    const hasImageRefs = referencesImageFiles(event.text);
    const hasAttachedImages = Boolean(event.images?.length);

    if (!hasImageRefs && !hasAttachedImages) {
      warn(
        "Model called `look_at` tool when message didn't include image reference or image attachments.",
      );
      return;
    }

    return { action: "transform", text: event.text + NUDGE_TEXT };
  });
}
