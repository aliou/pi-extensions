import { describe, expect, it } from "vitest";
import { parseSubagentTranscript } from "./transcript";

const header =
  '{"type":"session","version":3,"id":"s1","timestamp":"2026-01-01T00:00:00.000Z"}';

const userEntry = (id: string, text: string) =>
  JSON.stringify({
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-01-01T00:00:01.000Z",
    message: {
      role: "user",
      content: [{ type: "text", text }],
      timestamp: 0,
    },
  });

const userEntryWithImage = (
  id: string,
  text: string,
  data: string,
  mimeType = "image/png",
) =>
  JSON.stringify({
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-01-01T00:00:01.000Z",
    message: {
      role: "user",
      content: [
        { type: "text", text },
        { type: "image", data, mimeType },
      ],
      timestamp: 0,
    },
  });

const assistantEntry = (
  id: string,
  text: string,
  thinking = false,
  usage?: Record<string, unknown>,
) =>
  JSON.stringify({
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-01-01T00:00:02.000Z",
    message: {
      role: "assistant",
      content: thinking
        ? [
            { type: "thinking", thinking: "internal" },
            { type: "text", text },
          ]
        : [{ type: "text", text }],
      timestamp: 0,
      ...(usage ? { usage } : {}),
    },
  });

const toolResultEntry = (id: string, text: string) =>
  JSON.stringify({
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-01-01T00:00:03.000Z",
    message: {
      role: "toolResult",
      content: [{ type: "text", text }],
      timestamp: 0,
    },
  });

const jsonl = (...lines: string[]) => lines.join("\n");

describe("parseSubagentTranscript", () => {
  it("returns undefined for empty content", () => {
    expect(parseSubagentTranscript("")).toBeUndefined();
  });

  it("returns undefined when there are no messages", () => {
    expect(parseSubagentTranscript(jsonl(header))).toBeUndefined();
  });

  it("extracts the first user message as input", () => {
    const transcript = parseSubagentTranscript(
      jsonl(header, userEntry("u1", "what is 2+2")),
    );
    expect(transcript?.input).toBe("what is 2+2");
    expect(transcript?.output).toBeUndefined();
  });

  it("extracts the last assistant message as output", () => {
    const transcript = parseSubagentTranscript(
      jsonl(
        header,
        userEntry("u1", "hi"),
        assistantEntry("a1", "hello"),
        assistantEntry("a2", "bye"),
      ),
    );
    expect(transcript?.output).toBe("bye");
  });

  it("skips thinking blocks when extracting assistant text", () => {
    const transcript = parseSubagentTranscript(
      jsonl(header, userEntry("u1", "q"), assistantEntry("a1", "answer", true)),
    );
    expect(transcript?.output).toBe("answer");
  });

  it("ignores assistant entries with no text content", () => {
    const noText = JSON.stringify({
      type: "message",
      id: "a0",
      parentId: null,
      timestamp: "2026-01-01T00:00:02.000Z",
      message: {
        role: "assistant",
        content: [{ type: "thinking", thinking: "hmm" }],
        timestamp: 0,
      },
    });
    const transcript = parseSubagentTranscript(
      jsonl(header, userEntry("u1", "q"), noText, assistantEntry("a1", "real")),
    );
    expect(transcript?.output).toBe("real");
  });

  it("handles string message content", () => {
    const strUser = JSON.stringify({
      type: "message",
      id: "u2",
      parentId: null,
      timestamp: "2026-01-01T00:00:01.000Z",
      message: { role: "user", content: "plain string question", timestamp: 0 },
    });
    const transcript = parseSubagentTranscript(jsonl(header, strUser));
    expect(transcript?.input).toBe("plain string question");
  });

  it("tolerates malformed JSON lines", () => {
    const transcript = parseSubagentTranscript(
      jsonl(header, "{not valid json", userEntry("u1", "q")),
    );
    expect(transcript?.input).toBe("q");
  });

  it("returns input, output and stats for a normal exchange", () => {
    const transcript = parseSubagentTranscript(
      jsonl(
        header,
        userEntry("u1", "hello"),
        assistantEntry("a1", "world", false, {
          input: 100,
          output: 25,
          cost: { total: 0.0004 },
        }),
      ),
    );
    expect(transcript).toMatchObject({
      input: "hello",
      output: "world",
      inputTokens: 100,
      outputTokens: 25,
      cost: 0.0004,
    });
  });

  it("extracts the last tool result as toolResult and counts tool calls", () => {
    const transcript = parseSubagentTranscript(
      jsonl(
        header,
        userEntry("u1", "name this session"),
        assistantEntry("a1", "ok", false),
        toolResultEntry("t1", "my session name"),
      ),
    );
    expect(transcript?.toolResult).toBe("my session name");
    expect(transcript?.toolCalls).toBe(1);
  });

  it("extracts the image attached to the first user message", () => {
    const transcript = parseSubagentTranscript(
      jsonl(
        header,
        userEntryWithImage("u1", "describe this", "BASE64DATA"),
        assistantEntry("a1", "a screenshot"),
      ),
    );
    expect(transcript?.input).toBe("describe this");
    expect(transcript?.image).toEqual({
      data: "BASE64DATA",
      mimeType: "image/png",
    });
  });

  it("returns undefined image when no image block is present", () => {
    const transcript = parseSubagentTranscript(
      jsonl(header, userEntry("u1", "plain"), assistantEntry("a1", "ans")),
    );
    expect(transcript?.image).toBeUndefined();
  });
});
