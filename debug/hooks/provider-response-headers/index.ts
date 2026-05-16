import { appendFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const LOG_DIR_PREFIX = join(tmpdir(), "provider-response-headers-");

let logDirPromise: Promise<string> | undefined;
let logDirNotified = false;
let sequence = 0;

interface MessageLike {
  role?: unknown;
  content?: unknown;
}

function sanitizeFilePart(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  return (
    raw.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback
  );
}

async function getLogDir(ctx: ExtensionContext): Promise<string> {
  logDirPromise ??= mkdtemp(LOG_DIR_PREFIX);
  const logDir = await logDirPromise;

  if (!logDirNotified) {
    logDirNotified = true;
    ctx.ui.notify(`Provider response headers tmpdir: ${logDir}`, "info");
  }

  return logDir;
}

async function getLogPath(ctx: ExtensionContext): Promise<string> {
  const provider = sanitizeFilePart(ctx.model?.provider, "unknown-provider");
  const sessionId = sanitizeFilePart(
    ctx.sessionManager.getSessionId() ||
      (ctx.sessionManager.getSessionFile()
        ? basename(ctx.sessionManager.getSessionFile() as string, ".jsonl")
        : undefined),
    "ephemeral-session",
  );

  const logDir = await getLogDir(ctx);
  return join(logDir, `${sessionId}__${provider}.jsonl`);
}

function textFromContent(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;

  const parts = content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return undefined;
      const dict = part as Record<string, unknown>;
      if (typeof dict.text === "string") return dict.text;
      if (typeof dict.content === "string") return dict.content;
      return undefined;
    })
    .filter((part): part is string => part !== undefined);

  return parts.length > 0 ? parts.join("\n") : undefined;
}

function extractSystemPrompts(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const dict = payload as Record<string, unknown>;
  const prompts: string[] = [];
  const directSystem = textFromContent(dict.system);
  if (directSystem) prompts.push(directSystem);
  const directInstructions = textFromContent(dict.instructions);
  if (directInstructions) prompts.push(directInstructions);

  if (Array.isArray(dict.messages)) {
    for (const message of dict.messages as MessageLike[]) {
      if (message?.role === "system" || message?.role === "developer") {
        const text = textFromContent(message.content);
        if (text) prompts.push(text);
      }
    }
  }

  if (Array.isArray(dict.input)) {
    for (const message of dict.input as MessageLike[]) {
      if (message?.role === "system" || message?.role === "developer") {
        const text = textFromContent(message.content);
        if (text) prompts.push(text);
      }
    }
  }

  return prompts;
}

function summarizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      payloadType: Array.isArray(payload) ? "array" : typeof payload,
      systemPrompts: extractSystemPrompts(payload),
    };
  }

  const dict = payload as Record<string, unknown>;
  const messages = Array.isArray(dict.messages) ? dict.messages : undefined;
  const input = Array.isArray(dict.input) ? dict.input : undefined;

  return {
    payloadType: "object",
    topLevelKeys: Object.keys(dict).sort(),
    payloadModel: typeof dict.model === "string" ? dict.model : undefined,
    maxTokens:
      typeof dict.max_tokens === "number"
        ? dict.max_tokens
        : typeof dict.max_completion_tokens === "number"
          ? dict.max_completion_tokens
          : undefined,
    temperature:
      typeof dict.temperature === "number" ? dict.temperature : undefined,
    messageRoles: messages
      ?.map((message) => (message as MessageLike | undefined)?.role)
      .filter((role): role is string => typeof role === "string"),
    inputRoles: input
      ?.map((message) => (message as MessageLike | undefined)?.role)
      .filter((role): role is string => typeof role === "string"),
    systemPrompts: extractSystemPrompts(payload),
  };
}

async function appendJsonl(
  ctx: ExtensionContext,
  entry: Record<string, unknown>,
) {
  await appendFile(await getLogPath(ctx), `${JSON.stringify(entry)}\n`, "utf8");
}

function baseEntry(ctx: ExtensionContext) {
  return {
    at: new Date().toISOString(),
    sequence: ++sequence,
    sessionId: ctx.sessionManager.getSessionId(),
    sessionFile: ctx.sessionManager.getSessionFile(),
    cwd: ctx.cwd,
    provider: ctx.model?.provider,
    model: ctx.model?.id,
  };
}

export default function providerResponseHeadersLogger(pi: ExtensionAPI): void {
  pi.on("before_provider_request", async (event, ctx) => {
    await appendJsonl(ctx, {
      ...baseEntry(ctx),
      event: "before_provider_request",
      payload: summarizePayload(event.payload),
    });
  });

  pi.on("after_provider_response", async (event, ctx) => {
    await appendJsonl(ctx, {
      ...baseEntry(ctx),
      event: "after_provider_response",
      status: event.status,
      headers: event.headers,
    });
  });
}
