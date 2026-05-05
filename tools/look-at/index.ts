import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineSubagent } from "@harness/agent-kit";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { MODEL_CANDIDATES } from "./models";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompt";
import { LookAtParams } from "./types";
import {
  disableTool,
  isVisionCapable,
  mimeTypeFromPath,
  referencesImageFiles,
} from "./utils";

const NUDGE_TEXT =
  "\n\nNote: the current model cannot see images. Use look_at to analyze any image files referenced above.";

const TOOL_NAME = "look_at";

function enableTool(pi: ExtensionAPI) {
  const active = pi.getActiveTools();
  if (!active.includes(TOOL_NAME)) {
    pi.setActiveTools([...active, TOOL_NAME]);
  }
}

export default function lookAt(pi: ExtensionAPI): void {
  const subagent = defineSubagent(pi, {
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

  pi.registerTool(subagent.tool);

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
    if (isVisionCapable(evt.model)) {
      disableTool(pi, TOOL_NAME);
    } else {
      enableTool(pi);
    }
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
