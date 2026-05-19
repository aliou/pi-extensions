import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
  BranchSummaryEntry,
  CompactionEntry,
  CustomMessageEntry,
  SessionEntry,
  SessionHeader,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";

type ContentPart = Record<string, unknown>;

export interface MarkdownExportInput {
  header: SessionHeader | null;
  entries: SessionEntry[];
  sessionId: string;
  exportedAt: Date;
}

function textContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const record = part as ContentPart;
      if (record.type === "text" && typeof record.text === "string") {
        return record.text;
      }
      if (record.type === "image" && typeof record.mimeType === "string") {
        return `[Image: ${record.mimeType}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function messageDate(message: AgentMessage): Date | undefined {
  if (!("timestamp" in message)) return undefined;
  const timestamp = message.timestamp;
  const date =
    typeof timestamp === "number"
      ? new Date(timestamp)
      : typeof timestamp === "string"
        ? new Date(timestamp)
        : undefined;
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date;
}

function entryDate(entry: SessionEntry): Date | undefined {
  const date = new Date(entry.timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function frontmatter(input: MarkdownExportInput): string {
  const dates = input.entries.flatMap((entry) => {
    if (entry.type === "message") {
      const date = messageDate(entry.message);
      if (date) return [date];
    }
    const date = entryDate(entry);
    return date ? [date] : [];
  });
  const start = dates.length
    ? new Date(Math.min(...dates.map((date) => date.getTime())))
    : input.exportedAt;
  const end = dates.length
    ? new Date(Math.max(...dates.map((date) => date.getTime())))
    : input.exportedAt;
  const models = Array.from(
    new Set(
      input.entries.flatMap((entry) => {
        if (entry.type !== "message") return [];
        const message = entry.message;
        return "model" in message && typeof message.model === "string"
          ? [message.model]
          : [];
      }),
    ),
  );

  return [
    "---",
    models.length > 0 ? "models:" : "models: []",
    ...models.map((model) => `  - ${yamlString(model)}`),
    `start_datetime: ${yamlString(start.toISOString())}`,
    `end_datetime: ${yamlString(end.toISOString())}`,
    "---",
    "",
  ].join("\n");
}

function formatLocalTime(timestamp: unknown): string {
  const date =
    typeof timestamp === "number"
      ? new Date(timestamp)
      : typeof timestamp === "string"
        ? new Date(timestamp)
        : undefined;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeMarkdown(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const output: string[] = [];
  let blankCount = 0;
  for (const line of trimmed.split("\n").map((line) => line.trimEnd())) {
    if (line.trim() === "") {
      blankCount += 1;
      if (blankCount <= 2) output.push("");
      continue;
    }
    blankCount = 0;
    output.push(line);
  }
  return output.join("\n").trim();
}

function fenceFor(text: string): string {
  let maxTicks = 2;
  for (const match of text.matchAll(/`+/g)) {
    maxTicks = Math.max(maxTicks, match[0].length);
  }
  return "`".repeat(maxTicks + 1);
}

function codeBlock(text: string, lang = ""): string {
  const fence = fenceFor(text);
  return `${fence}${lang}\n${text}\n${fence}`;
}

function callout(
  type: string,
  title: string,
  body: string,
  collapsed = false,
): string {
  const safeTitle = title.replace(/\s+/g, " ").trim();
  const marker = collapsed ? "-" : "";
  const lines = [`> [!${type}]${marker} ${safeTitle}`];
  if (body.trim()) {
    for (const line of body.split("\n")) lines.push(`> ${line}`);
  }
  return lines.join("\n");
}

function compactArgValue(value: unknown): unknown {
  if (typeof value === "string") {
    const compact = value.replace(/\s+/g, " ").trim();
    return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
  }
  if (Array.isArray(value)) {
    const head = value.slice(0, 5).map(compactArgValue);
    return value.length > 5 ? [...head, "..."] : head;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 6)
        .map(([key, item]) => [key, compactArgValue(item)]),
    );
  }
  return value;
}

function toolTitle(name: string, args: unknown): string {
  return `${name} ${JSON.stringify(compactArgValue(args ?? {}))}`.replace(
    /[[\]]/g,
    (match) => `\\${match}`,
  );
}

function toolResultBody(
  args: unknown,
  result: AgentMessage | undefined,
): string {
  const chunks = ["**Arguments**", "", codeBlock(safeJson(args ?? {}), "json")];
  if (result && result.role === "toolResult") {
    const content = textContent(result.content);
    chunks.push("", "**Result**", "");
    if (content) chunks.push(codeBlock(content, "text"));
    if (result.details !== undefined) {
      chunks.push(
        "",
        "**Details**",
        "",
        codeBlock(safeJson(result.details), "json"),
      );
    }
  } else {
    chunks.push("", "_No tool result was recorded._");
  }
  return chunks.join("\n");
}

function indentCallout(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function renderToolCallout(
  part: ContentPart,
  result: AgentMessage | undefined,
): string {
  const name = typeof part.name === "string" ? part.name : "tool";
  const args = part.arguments ?? {};
  const isError = result?.role === "toolResult" ? result.isError : false;
  const type = isError ? "pi-tool-error" : "pi-tool-success";
  return callout(
    type,
    toolTitle(name, args),
    toolResultBody(args, result),
    true,
  );
}

function renderToolsCallout(toolBlocks: string[], failed: number): string {
  const title = `Tool calls (${toolBlocks.length}${failed > 0 ? `, ${failed} failed` : ""})`;
  return callout(
    "pi-tools",
    title,
    toolBlocks.map(indentCallout).join("\n>\n"),
    true,
  );
}

function assistantName(message: AgentMessage): string {
  if ("model" in message && typeof message.model === "string")
    return message.model;
  return "Assistant";
}

function customTitle(customType: string, timestamp: string): string {
  const time = formatLocalTime(timestamp);
  return time ? `${customType} · ${time}` : customType;
}

function renderCustomMessageEntry(entry: CustomMessageEntry): string {
  return callout(
    "pi-custom-message",
    customTitle(entry.customType, entry.timestamp),
    normalizeMarkdown(textContent(entry.content)) || "_No text content._",
  );
}

function renderCompaction(entry: CompactionEntry): string {
  return callout(
    "pi-compaction",
    `Compaction · ${entry.tokensBefore} tokens summarized`,
    normalizeMarkdown(entry.summary),
  );
}

function renderBranchSummary(entry: BranchSummaryEntry): string {
  return callout(
    "pi-branch-summary",
    `Branch summary · from ${entry.fromId}`,
    normalizeMarkdown(entry.summary),
  );
}

function renderMessageEntry(
  entry: SessionMessageEntry,
  toolResults: Map<string, AgentMessage>,
): string[] {
  const message = entry.message;
  if (message.role === "toolResult") return [];

  if (message.role === "user") {
    return [
      `<div class="pi-export-role pi-export-user">You · ${formatLocalTime(message.timestamp)}</div>`,
      "",
      normalizeMarkdown(textContent(message.content)) || "_No text content._",
    ];
  }

  if (message.role === "custom") {
    return [
      callout(
        "pi-custom-message",
        customTitle(message.customType, String(message.timestamp)),
        normalizeMarkdown(textContent(message.content)) || "_No text content._",
      ),
    ];
  }

  if (message.role === "bashExecution") {
    return [
      callout(
        "pi-bash",
        `Bash · exit ${message.exitCode ?? "unknown"}`,
        [
          "**Command**",
          "",
          codeBlock(message.command, "sh"),
          "",
          "**Output**",
          "",
          codeBlock(message.output, "text"),
        ].join("\n"),
        true,
      ),
    ];
  }

  if (message.role === "assistant" && Array.isArray(message.content)) {
    const lines = [
      `<div class="pi-export-role pi-export-assistant">${assistantName(message)} · ${formatLocalTime(message.timestamp)}</div>`,
      "",
    ];
    const toolBlocks: string[] = [];
    let failed = 0;
    let emitted = false;

    for (const part of message.content) {
      if (!part || typeof part !== "object") continue;
      const record = part as unknown as ContentPart;
      if (record.type === "text" && typeof record.text === "string") {
        const text = normalizeMarkdown(record.text);
        if (text) {
          lines.push(text, "");
          emitted = true;
        }
      } else if (
        record.type === "thinking" &&
        typeof record.thinking === "string"
      ) {
        lines.push(
          callout("pi-reasoning", "Reasoning", record.thinking.trim(), true),
          "",
        );
        emitted = true;
      } else if (record.type === "toolCall" && typeof record.id === "string") {
        const result = toolResults.get(record.id);
        if (result?.role === "toolResult" && result.isError) failed += 1;
        toolBlocks.push(renderToolCallout(record, result));
        emitted = true;
      }
    }

    if (toolBlocks.length > 0)
      lines.push(renderToolsCallout(toolBlocks, failed), "");
    if (!emitted) lines.push("_No visible assistant content._", "");
    if (message.errorMessage) {
      lines.push(
        callout(
          "pi-tool-error",
          "Assistant error",
          codeBlock(message.errorMessage, "text"),
        ),
        "",
      );
    }
    return lines.filter(
      (line, index, array) => !(line === "" && array[index - 1] === ""),
    );
  }

  return [
    `<div class="pi-export-role">${message.role} · ${"timestamp" in message ? formatLocalTime(message.timestamp) : ""}</div>`,
    "",
    codeBlock(safeJson(message), "json"),
  ];
}

export function buildSessionMarkdown(input: MarkdownExportInput): string {
  const toolResults = new Map<string, AgentMessage>();
  for (const entry of input.entries) {
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message.role === "toolResult")
      toolResults.set(message.toolCallId, message);
  }

  const markdown = [
    frontmatter(input),
    "# Pi Session Export",
    "",
    `<div class="pi-export-session-meta">Session <code>${input.sessionId}</code> · exported ${input.exportedAt.toISOString()}</div>`,
    "",
  ];

  let firstVisible = true;
  for (const entry of input.entries) {
    let block: string[] = [];
    if (entry.type === "message")
      block = renderMessageEntry(entry, toolResults);
    else if (entry.type === "custom_message")
      block = [renderCustomMessageEntry(entry)];
    else if (entry.type === "compaction") block = [renderCompaction(entry)];
    else if (entry.type === "branch_summary")
      block = [renderBranchSummary(entry)];

    if (block.length === 0) continue;
    if (!firstVisible) markdown.push("", "---", "");
    firstVisible = false;
    markdown.push(...block, "");
  }

  return `${markdown.join("\n").trim()}\n`;
}
