/**
 * Look At - Analyze image files using a vision-capable model.
 *
 * When using a non-vision model, this tool lets the agent "see" images by
 * delegating to a vision-capable model via createAgentSession. The vision
 * model's analysis is returned as text.
 *
 * Also registers an `input` event hook that nudges the agent to use look_at
 * when the user message references image files and the current model lacks
 * vision support.
 *
 * Inspired by Amp's "Look At" tool.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

function mimeTypeFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_TO_MIME[ext] ?? null;
}

import { referencesImageFiles } from "./utils";

/** Find a vision-capable model from the registry. */
function findVisionModel(ctx: ExtensionContext) {
  const available = ctx.modelRegistry.getAvailable();
  // Prefer models from the same provider as the current model
  const currentProvider = ctx.model?.provider;
  if (currentProvider) {
    const sameProvider = available.find(
      (m) =>
        m.provider === currentProvider && m.input.includes("image" as never),
    );
    if (sameProvider) return sameProvider;
  }
  // Fall back to any vision model
  return available.find((m) => m.input.includes("image" as never));
}

// ---------------------------------------------------------------------------
// Tool parameters
// ---------------------------------------------------------------------------

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

type LookAtParamsType = (typeof LookAtParams)["_static"];

interface LookAtDetails {
  path: string;
  objective: string;
  visionModel: string;
  visionProvider: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Core execution
// ---------------------------------------------------------------------------

async function analyzeImage(
  absolutePath: string,
  objective: string,
  context: string | undefined,
  visionModel: { id: string; provider: string },
  ctx: ExtensionContext,
  signal?: AbortSignal,
): Promise<{
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}> {
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.inMemory();
  const resourceLoader = new DefaultResourceLoader({
    cwd: ctx.cwd,
    agentDir,
    settingsManager,
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
    noSkills: true,
    systemPromptOverride: () => ANALYSIS_SYSTEM_PROMPT,
    appendSystemPromptOverride: () => [],
    agentsFilesOverride: () => ({ agentsFiles: [] }),
    skillsOverride: () => ({ skills: [], diagnostics: [] }),
  });
  await resourceLoader.reload();

  const model = ctx.modelRegistry.find(visionModel.provider, visionModel.id);
  if (!model) {
    throw new Error(
      `Vision model ${visionModel.provider}/${visionModel.id} not found in registry`,
    );
  }

  const { session } = await createAgentSession({
    model,
    thinkingLevel: "low",
    tools: [],
    customTools: [],
    sessionManager: SessionManager.inMemory(),
    modelRegistry: ctx.modelRegistry,
    resourceLoader,
  });

  // Read the image file
  const buffer = await readFile(absolutePath);
  const base64 = buffer.toString("base64");
  const mimeType = mimeTypeFromPath(absolutePath);

  if (!mimeType) {
    throw new Error(`Unsupported image format for ${absolutePath}`);
  }

  let accumulated = "";
  let aborted = false;
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
  };

  const unsubscribe = session.subscribe((event) => {
    if (event.type === "message_update") {
      if (event.assistantMessageEvent.type === "text_delta") {
        accumulated += event.assistantMessageEvent.delta;
      }
    }
    if (event.type === "turn_end") {
      const msg = event.message;
      if (msg.role === "assistant") {
        const assistantMsg = msg as AssistantMessage & {
          usage?: { input: number; output: number };
        };
        if (assistantMsg.usage) {
          usage.inputTokens += assistantMsg.usage.input;
          usage.outputTokens += assistantMsg.usage.output;
        }
      }
    }
  });

  if (signal) {
    if (signal.aborted) {
      unsubscribe();
      session.dispose();
      throw new Error("Operation aborted");
    }
    signal.addEventListener(
      "abort",
      () => {
        session.abort();
        aborted = true;
      },
      { once: true },
    );
  }

  try {
    const userText = context
      ? `Context: ${context}\n\nObjective: ${objective}`
      : objective;

    await session.prompt(userText, {
      images: [{ type: "image" as const, data: base64, mimeType }],
    });
  } catch (err) {
    if (signal?.aborted) {
      aborted = true;
    } else {
      throw err;
    }
  } finally {
    unsubscribe();
    session.dispose();
  }

  if (aborted) {
    throw new Error("Operation aborted");
  }

  return { text: accumulated, usage };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI): void {
  // --- look_at tool ---

  pi.registerTool<typeof LookAtParams, LookAtDetails>({
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
    promptSnippet: "Analyze an image file",
    promptGuidelines: [
      "Use look_at when you need to understand the content of an image file.",
      "Always provide a clear objective.",
    ],
    parameters: LookAtParams,

    async execute(
      _toolCallId: string,
      params: LookAtParamsType,
      signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: ExtensionContext,
    ): Promise<AgentToolResult<LookAtDetails>> {
      const { path: rawPath, objective, context } = params;
      const absolutePath = resolve(ctx.cwd, rawPath);

      // Find a vision model
      const visionModel = findVisionModel(ctx);
      if (!visionModel) {
        return {
          content: [
            {
              type: "text",
              text: `No vision-capable model available. Configure a model that supports images (check your API keys).`,
            },
          ],
          details: {
            path: absolutePath,
            objective,
            visionModel: "none",
            visionProvider: "none",
          },
        };
      }

      try {
        const result = await analyzeImage(
          absolutePath,
          objective,
          context,
          { id: visionModel.id, provider: visionModel.provider },
          ctx,
          signal,
        );

        return {
          content: [{ type: "text", text: result.text }],
          details: {
            path: absolutePath,
            objective,
            visionModel: visionModel.id,
            visionProvider: visionModel.provider,
            usage: result.usage,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Image analysis failed: ${message}`);
      }
    },
  });

  // --- Input nudge: when user references an image and model lacks vision ---

  pi.on("input", (event, ctx) => {
    const model = ctx.model;
    const hasImageRefs = referencesImageFiles(event.text);
    const hasAttachedImages = Boolean(event.images?.length);
    const modelHasVision = Boolean(model?.input.includes("image" as never));

    if (!model) return;
    if (modelHasVision) return;
    if (!hasImageRefs && !hasAttachedImages) return;

    return { action: "transform", text: event.text + NUDGE_TEXT };
  });
}
