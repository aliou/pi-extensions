import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createSubagent } from "@harness/agent-kit";
import { convertBmpToPng } from "@harness/image-formats";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompt";
import { renderLookAtDetails, renderLookAtHeader } from "./render";
import { LookAtParams, type LookAtParamsInput } from "./types";
import {
  detectSupportedImageMimeType,
  disableTool,
  injectLookAtGuidance,
  isVisionCapable,
} from "./utils";

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

Use this tool when you need to understand or extract information from an image file (PNG, JPG, GIF, WebP, BMP, etc.). The current model cannot see images directly -- this tool delegates to a vision model that can.

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
    // Primary: synthetic Kimi-K2.7-Code (vision). Fallback: neuralwatt
    // kimi-k2.7-code -- same model on the other provider. Kimi-K2.7-Code is
    // thinking-only: "off" clamps to "medium" (its sole level), so "low" is used
    // to express the lowest available effort. ~9% bleed at weight 0.1.
    modelPreferences: [
      {
        provider: "synthetic",
        model: "hf:moonshotai/Kimi-K2.7-Code",
        thinking: "low",
        weight: 1,
      },
      {
        provider: "neuralwatt",
        model: "kimi-k2.7-code",
        thinking: "low",
        weight: 0.1,
      },
    ],
    parameters: LookAtParams,
    renderHeader: renderLookAtHeader,
    renderDetails: renderLookAtDetails,
    async buildPrompt(params, ctx) {
      const absolutePath = resolve(ctx.cwd, params.path);
      const buffer = readFileSync(absolutePath);
      const mimeType = detectSupportedImageMimeType(buffer);
      if (!mimeType)
        throw new Error(`Unsupported image format for ${absolutePath}`);

      const userText = params.context
        ? `Context: ${params.context}\n\nObjective: ${params.objective}`
        : params.objective;

      let imageData = buffer.toString("base64");
      let imageMimeType = mimeType;
      if (mimeType === "image/bmp") {
        const png = await convertBmpToPng(buffer);
        imageData = png.toString("base64");
        imageMimeType = "image/png";
      }

      return {
        text: userText,
        images: [
          {
            type: "image" as const,
            data: imageData,
            mimeType: imageMimeType,
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
      return tool.execute(toolCallId, params, signal, onUpdate, ctx);
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

  // When the active model cannot see images, detect referenced image files in
  // the conversation and append look_at guidance to those user messages. The
  // context event is non-destructive: changes are re-applied each LLM call and
  // never persisted to the session file.
  pi.on("context", (event, ctx) => {
    if (!pi.getActiveTools().includes(TOOL_NAME)) return;

    const model = ctx.model;
    if (!model || isVisionCapable(model)) return;

    if (!injectLookAtGuidance(event.messages, ctx.cwd)) return;
    return { messages: event.messages };
  });
}
