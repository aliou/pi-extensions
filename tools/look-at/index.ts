import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import { MODEL_CANDIDATES } from "./models";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompt";
import { LookAtParams, type LookAtParamsInput } from "./types";
import {
  disableTool,
  isVisionCapable,
  mimeTypeFromPath,
  referencesImageFiles,
} from "./utils";

const NUDGE_TEXT = `

<pi_runtime_instruction source="look_at" user_visible="false">
This instruction was inserted by the Pi look_at extension, not by the user.
The user message is above this block.
The user has referenced or attached image files; use the look_at tool to analyze them before answering.
</pi_runtime_instruction>`;

const TOOL_NAME = "look_at";

function enableTool(pi: ExtensionAPI) {
  const active = pi.getActiveTools();
  if (!active.includes(TOOL_NAME)) {
    pi.setActiveTools([...active, TOOL_NAME]);
  }
}

export default function lookAt(pi: ExtensionAPI): void {
  const subagent = createSubagent(pi, {
    name: TOOL_NAME,
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
    promptGuidelines: [
      "look_at: Use when you need to understand or extract information from an image file.",
      "look_at: Do not use for source code or plain text files -- use read instead.",
      "look_at: Always provide a clear objective describing what you want to learn from the image.",
      "look_at: Use context parameter to provide broader context about why you need the analysis.",
    ],
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

  const tool = subagent.asTool();
  subagent.subscribe();

  pi.registerTool({
    ...tool,

    async execute(
      toolCallId,
      params: LookAtParamsInput,
      signal,
      onUpdate,
      ctx,
    ) {
      const absolutePath = resolve(ctx.cwd, params.path);
      const mimeType = mimeTypeFromPath(absolutePath);

      const result = await tool.execute(
        toolCallId,
        params,
        signal,
        onUpdate,
        ctx,
      );

      if (!mimeType) return result;

      const buffer = readFileSync(absolutePath);
      return {
        ...result,
        content: [
          ...result.content,
          {
            type: "image" as const,
            data: buffer.toString("base64"),
            mimeType,
          },
        ],
      };
    },
  });

  pi.on("agent_start", (_evt, ctx) => {
    const model = ctx.model;
    if (!model) return;

    if (isVisionCapable(model)) {
      disableTool(pi, TOOL_NAME);
    } else {
      enableTool(pi);
    }
  });

  pi.on("model_select", (evt, _ctx) => {
    isVisionCapable(evt.model) ? disableTool(pi, TOOL_NAME) : enableTool(pi);
  });

  pi.on("input", (event, ctx) => {
    const isEnabled = pi.getActiveTools().includes(TOOL_NAME);
    if (!isEnabled) return;

    const model = ctx.model;
    if (!model) return;

    if (isVisionCapable(model)) {
      return;
    }

    const hasImageRefs = referencesImageFiles(event.text);
    const hasAttachedImages = Boolean(event.images?.length);

    if (!hasImageRefs && !hasAttachedImages) {
      return;
    }

    return { action: "transform", text: event.text + NUDGE_TEXT };
  });
}
