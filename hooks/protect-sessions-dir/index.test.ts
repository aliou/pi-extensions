import { join, resolve } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { AD_NOTIFY_ATTENTION_EVENT } from "@harness/events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import protectSessionsDirHook, { _resetForTesting } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sessionFile(relativePath: string): string {
  return resolve(join(getAgentDir(), "sessions"), relativePath);
}

/** Build a mock ExtensionAPI that captures tool_call handlers. */
function createMockPi(): {
  pi: ExtensionAPI;
  events: { emit: ReturnType<typeof vi.fn> };
  handlers: Map<string, Array<(event: unknown, ctx: unknown) => unknown>>;
  onFn: ReturnType<typeof vi.fn>;
} {
  const handlers: Map<
    string,
    Array<(event: unknown, ctx: unknown) => unknown>
  > = new Map();
  const events = { emit: vi.fn() };

  const onFn = vi.fn(
    (event: string, handler: (...args: unknown[]) => unknown) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
  );

  const pi = {
    on: onFn,
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    events: events as unknown as ExtensionAPI["events"],
  } as unknown as ExtensionAPI;

  return { pi, events, handlers, onFn };
}

/** Build a mock ExtensionContext. */
function createMockCtx(
  overrides: { hasUI?: boolean; customResult?: string } = {},
) {
  return {
    hasUI: overrides.hasUI ?? true,
    ui: {
      custom: vi.fn(async () => overrides.customResult ?? "allow-once"),
      select: vi.fn(),
      confirm: vi.fn(),
      input: vi.fn(),
      notify: vi.fn(),
      onTerminalInput: vi.fn(),
      setEditorText: vi.fn(),
      getEditorText: vi.fn(),
      setToolsExpanded: vi.fn(),
    },
    cwd: process.cwd(),
    signal: undefined,
  } as unknown as ExtensionContext;
}

/** Create a tool_call event for file tools. */
function fileToolEvent(
  toolName: "read" | "write" | "edit",
  path: string,
  toolCallId = "tc_1",
): ToolCallEvent {
  return {
    type: "tool_call",
    toolName,
    toolCallId,
    input: { path, file_path: path } as never,
  } as ToolCallEvent;
}

/** Create a tool_call event for bash. */
function bashToolEvent(command: string, toolCallId = "tc_1"): ToolCallEvent {
  return {
    type: "tool_call",
    toolName: "bash",
    toolCallId,
    input: { command } as never,
  } as ToolCallEvent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("protect-sessions-dir", () => {
  let mockPi: ReturnType<typeof createMockPi>;
  let toolCallHandler: (
    event: ToolCallEvent,
    ctx: ExtensionContext,
  ) => Promise<unknown>;

  beforeEach(() => {
    _resetForTesting();
    mockPi = createMockPi();
    protectSessionsDirHook(mockPi.pi);

    // Extract the registered tool_call handler.
    const onCalls = mockPi.onFn.mock.calls as Array<
      [string, (...args: unknown[]) => unknown]
    >;
    const toolCallEntry = onCalls.find(([event]) => event === "tool_call");
    expect(toolCallEntry).toBeDefined();
    toolCallHandler = toolCallEntry?.[1] as typeof toolCallHandler;
  });

  // ---- Read tests ----

  it("read: allow once — second read still shows dialog", async () => {
    const ctx = createMockCtx({ customResult: "allow-once" });
    const path = sessionFile("abc/file.json");
    const event = fileToolEvent("read", path);

    const result1 = await toolCallHandler(event, ctx);
    expect(result1).toBeUndefined(); // not blocked

    const ctx2 = createMockCtx({ customResult: "allow-once" });
    const result2 = await toolCallHandler(event, ctx2);
    expect(result2).toBeUndefined(); // still allowed, but dialog was shown again
    expect(ctx2.ui.custom).toHaveBeenCalled();
  });

  it("read: allow-path — second read of same path auto-approved", async () => {
    const path = sessionFile("abc/file.json");
    const event = fileToolEvent("read", path);

    const ctx1 = createMockCtx({ customResult: "allow-path" });
    await toolCallHandler(event, ctx1);

    const ctx2 = createMockCtx({ customResult: "allow-once" });
    const result2 = await toolCallHandler(event, ctx2);
    expect(result2).toBeUndefined(); // auto-approved
    expect(ctx2.ui.custom).not.toHaveBeenCalled();
  });

  it("read: allow-all — different session file auto-approved", async () => {
    const path1 = sessionFile("abc/file.json");
    const path2 = sessionFile("xyz/file.json");

    const ctx1 = createMockCtx({ customResult: "allow-all" });
    await toolCallHandler(fileToolEvent("read", path1), ctx1);

    const ctx2 = createMockCtx();
    const result2 = await toolCallHandler(fileToolEvent("read", path2), ctx2);
    expect(result2).toBeUndefined();
    expect(ctx2.ui.custom).not.toHaveBeenCalled();
  });

  // ---- Bash tests ----

  it("bash: allow once — same command re-emitted shows dialog again", async () => {
    const path = sessionFile("abc/file.json");
    const cmd = `cat ${path}`;
    const event = bashToolEvent(cmd);

    const ctx1 = createMockCtx({ customResult: "allow-once" });
    const result1 = await toolCallHandler(event, ctx1);
    expect(result1).toBeUndefined();

    const ctx2 = createMockCtx({ customResult: "allow-once" });
    await toolCallHandler(event, ctx2);
    expect(ctx2.ui.custom).toHaveBeenCalled();
  });

  it("bash: allow-path — different command same path auto-approved", async () => {
    const path = sessionFile("abc/file.json");
    const cmd1 = `cat ${path}`;
    const cmd2 = `head ${path}`;

    const ctx1 = createMockCtx({ customResult: "allow-path" });
    await toolCallHandler(bashToolEvent(cmd1), ctx1);

    const ctx2 = createMockCtx();
    const result2 = await toolCallHandler(bashToolEvent(cmd2), ctx2);
    expect(result2).toBeUndefined();
    expect(ctx2.ui.custom).not.toHaveBeenCalled();
  });

  it("bash: allow-all — different session path auto-approved", async () => {
    const path1 = sessionFile("abc/file.json");
    const path2 = sessionFile("xyz/file.json");

    const ctx1 = createMockCtx({ customResult: "allow-all" });
    await toolCallHandler(bashToolEvent(`cat ${path1}`), ctx1);

    const ctx2 = createMockCtx();
    const result2 = await toolCallHandler(bashToolEvent(`cat ${path2}`), ctx2);
    expect(result2).toBeUndefined();
    expect(ctx2.ui.custom).not.toHaveBeenCalled();
  });

  it("bash: different command same path — path-based approval works", async () => {
    const path = sessionFile("abc/file.json");
    const cmd1 = `cat ${path}`;
    const cmd2 = `head ${path}`;

    const ctx1 = createMockCtx({ customResult: "allow-path" });
    await toolCallHandler(bashToolEvent(cmd1), ctx1);

    const ctx2 = createMockCtx();
    const result2 = await toolCallHandler(bashToolEvent(cmd2), ctx2);
    expect(result2).toBeUndefined();
    expect(ctx2.ui.custom).not.toHaveBeenCalled();
  });

  // ---- Write/Edit always blocked ----

  it("write: always blocked even with allowAll", async () => {
    // Set allowAll by approving a read first.
    const ctx0 = createMockCtx({ customResult: "allow-all" });
    await toolCallHandler(
      fileToolEvent("read", sessionFile("abc/file.json")),
      ctx0,
    );

    const ctx = createMockCtx();
    const path = sessionFile("abc/file.json");
    const result = await toolCallHandler(fileToolEvent("write", path), ctx);
    expect(result).toEqual({ block: true, reason: expect.any(String) });
    expect(ctx.ui.custom).not.toHaveBeenCalled();
  });

  it("edit: always blocked even with allowAll", async () => {
    const ctx0 = createMockCtx({ customResult: "allow-all" });
    await toolCallHandler(
      fileToolEvent("read", sessionFile("abc/file.json")),
      ctx0,
    );

    const ctx = createMockCtx();
    const path = sessionFile("abc/file.json");
    const result = await toolCallHandler(fileToolEvent("edit", path), ctx);
    expect(result).toEqual({ block: true, reason: expect.any(String) });
    expect(ctx.ui.custom).not.toHaveBeenCalled();
  });

  // ---- Non-session paths not gated ----

  it("bash: non-session paths not gated", async () => {
    const ctx = createMockCtx();
    const result = await toolCallHandler(bashToolEvent("ls /tmp"), ctx);
    expect(result).toBeUndefined();
    expect(ctx.ui.custom).not.toHaveBeenCalled();
  });

  it("read: non-session path not gated", async () => {
    const ctx = createMockCtx();
    const result = await toolCallHandler(
      fileToolEvent("read", "/tmp/some-file.txt"),
      ctx,
    );
    expect(result).toBeUndefined();
    expect(ctx.ui.custom).not.toHaveBeenCalled();
  });

  // ---- Ambiguous / variable expansion ----

  it("bash: ambiguous command (variable expansion) — limited dialog options", async () => {
    // This command has no extractable absolute paths, but references
    // sessions dir via variable expansion that can't be resolved.

    // This command contains no extractable absolute paths, but references
    // "/.pi/agent/sessions" isn't literal. However the variable $SESSIONS_DIR
    // won't be in the command string. Let's use a literal sessions dir reference
    // that the AST can't resolve.
    // Actually: the command has no "/" and no literal sessions dir reference,
    // so it would NOT be gated. We need a command that references sessions dir
    // via an unresolvable path.
    const sessionsDir = join(getAgentDir(), "sessions");
    const ambiguousCmd = `cat ${sessionsDir}/$VAR/file.json`;
    const ambiguousEvent = bashToolEvent(ambiguousCmd);

    const ctx = createMockCtx({ customResult: "allow-once" });
    const result = await toolCallHandler(ambiguousEvent, ctx);
    expect(result).toBeUndefined();
    // Dialog should have been shown
    expect(ctx.ui.custom).toHaveBeenCalled();
  });

  // ---- All targets must be approved ----

  it("bash: all targets approved when allow-path is chosen", async () => {
    const path1 = sessionFile("abc/file.json");
    const path2 = sessionFile("xyz/file.json");
    const cmd = `cat ${path1} ${path2}`;

    // allow-path adds ALL targets to approvedSubtrees.
    const ctx1 = createMockCtx({ customResult: "allow-path" });
    await toolCallHandler(bashToolEvent(cmd), ctx1);

    // Both targets are now approved, so second call auto-approves.
    const ctx2 = createMockCtx({ customResult: "allow-once" });
    const result2 = await toolCallHandler(bashToolEvent(cmd), ctx2);
    expect(result2).toBeUndefined();
    expect(ctx2.ui.custom).not.toHaveBeenCalled();
  });

  // ---- Relative suspicious path ----

  it("read: relative suspicious path shows dialog (ambiguous)", async () => {
    const ctx = createMockCtx({ customResult: "allow-once" });
    const result = await toolCallHandler(
      fileToolEvent("read", "some/../../.pi/agent/sessions/abc/file.json"),
      ctx,
    );
    // Ambiguous: shows dialog, not hard-blocked
    expect(ctx.ui.custom).toHaveBeenCalled();
    expect(result).toBeUndefined(); // allowed after dialog
  });

  // ---- No UI ----

  it("no UI: blocks session file read", async () => {
    const ctx = createMockCtx({ hasUI: false });
    const path = sessionFile("abc/file.json");
    const result = await toolCallHandler(fileToolEvent("read", path), ctx);
    expect(result).toEqual({ block: true, reason: expect.any(String) });
  });

  it("no UI: blocks session-dir bash", async () => {
    const ctx = createMockCtx({ hasUI: false });
    const path = sessionFile("abc/file.json");
    const result = await toolCallHandler(bashToolEvent(`cat ${path}`), ctx);
    expect(result).toEqual({ block: true, reason: expect.any(String) });
  });

  // ---- Bash parse failure fallback ----

  it("bash: unresolvable variable in path — ambiguous fallback", async () => {
    // A command with variable substitution in the path cannot have its
    // paths reconstructed from the AST. The literal sessions dir in the
    // command string triggers ambiguous mode.
    const sessionsDir = join(getAgentDir(), "sessions");
    const cmdWithVar = `cat "${sessionsDir}/$UNRESOLVABLE/file.json"`;
    const event = bashToolEvent(cmdWithVar);

    const ctx = createMockCtx({ customResult: "allow-once" });
    await toolCallHandler(event, ctx);
    // The double-quoted part with $UNRESOLVABLE means the word can't be
    // reconstructed, so no specific paths are extracted. The literal
    // sessions dir in the string triggers ambiguous mode.
    expect(ctx.ui.custom).toHaveBeenCalled();
  });

  // ---- Event emission ----

  it("emits attention event on write block", async () => {
    const path = sessionFile("abc/file.json");
    await toolCallHandler(fileToolEvent("write", path), createMockCtx());

    expect(mockPi.events.emit).toHaveBeenCalledWith(
      AD_NOTIFY_ATTENTION_EVENT,
      expect.objectContaining({
        source: "breadcrumbs:protect-sessions-dir",
        description: "Blocked: direct session file write",
      }),
    );
  });

  it("emits attention event on confirmation dialog", async () => {
    const path = sessionFile("abc/file.json");
    await toolCallHandler(
      fileToolEvent("read", path),
      createMockCtx({ customResult: "allow-once" }),
    );

    expect(mockPi.events.emit).toHaveBeenCalledWith(
      AD_NOTIFY_ATTENTION_EVENT,
      expect.objectContaining({
        source: "breadcrumbs:protect-sessions-dir",
        description: "Confirmation required: read a session file directly",
      }),
    );
  });

  it("emits attention event on deny", async () => {
    const path = sessionFile("abc/file.json");
    const result = await toolCallHandler(
      fileToolEvent("read", path),
      createMockCtx({ customResult: "deny" }),
    );
    expect(result).toEqual({ block: true, reason: expect.any(String) });

    expect(mockPi.events.emit).toHaveBeenCalledWith(
      AD_NOTIFY_ATTENTION_EVENT,
      expect.objectContaining({
        source: "breadcrumbs:protect-sessions-dir",
        description: "Confirmation required: read a session file directly",
      }),
    );
  });

  // ---- Path subtree coverage ----

  it("allow-path covers sibling files under the approved directory", async () => {
    const filePath = sessionFile("abc/sub/file.json");

    // Approve the parent directory via a read on a file inside it.
    // allow-path adds dirname(target) = abc/sub/ to approvedSubtrees.
    const ctx1 = createMockCtx({ customResult: "allow-path" });
    await toolCallHandler(fileToolEvent("read", filePath), ctx1);

    // Reading a sibling file under the same approved directory should be auto-approved.
    const siblingFilePath = sessionFile("abc/sub/other.json");
    const ctx2 = createMockCtx({ customResult: "allow-once" });
    const result2 = await toolCallHandler(
      fileToolEvent("read", siblingFilePath),
      ctx2,
    );
    expect(result2).toBeUndefined();
    expect(ctx2.ui.custom).not.toHaveBeenCalled();

    // But a file in a parent directory (abc/) is NOT covered.
    const parentFilePath = sessionFile("abc/other.json");
    const ctx3 = createMockCtx({ customResult: "allow-once" });
    await toolCallHandler(fileToolEvent("read", parentFilePath), ctx3);
    expect(ctx3.ui.custom).toHaveBeenCalled();
  });
});
