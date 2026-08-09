/**
 * Test harness that loads extension factories using real Pi internals.
 *
 * Instead of deep proxy mocks, this uses:
 * - Real `createEventBus()` and `createExtensionRuntime()`
 * - Real `loadExtensionFromFactory()` so extensions register through the
 *   actual `ExtensionAPI` code path
 * - Explicit vi.fn() spies for context objects (see pi-context.ts)
 *
 * The harness exposes the loaded `Extension` object so matchers and tests
 * can inspect registered commands, tools, and event handlers directly.
 *
 * Context overrides (sessionManager, UI spies, etc.) are set at harness
 * creation time and apply to every command execution. Per-call overrides
 * passed to `execute()` merge on top when needed.
 *
 * A built-in `newSession` spy creates a real `SessionManager.inMemory()`
 * for each child session and exposes it via `getChildSessionManager()`.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  Extension,
  ExtensionCommandContext,
  ExtensionFactory,
  ExtensionRuntime,
  RegisteredCommand,
  SessionManager,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import {
  createEventBus,
  createExtensionRuntime,
  SessionManager as SessionManagerClass,
} from "@earendil-works/pi-coding-agent";
import { vi } from "vitest";
import { loadExtensionFromFactory } from "./load-extension";
import {
  type CommandContextOverrides,
  createCommandContext,
  createToolContext,
  type ToolContextOverrides,
} from "./pi-context";

export interface PiTestHarness {
  /** Working directory used by the harness. */
  cwd: string;
  /** The real Extension object produced by the factory. */
  extension: Extension;
  /**
   * The shared ExtensionRuntime. Action methods (setModel, setThinkingLevel,
   * etc.) are throwing stubs until replaced. Tests can assign vi.fn() spies
   * directly to patch them before emitting events.
   */
  runtime: ExtensionRuntime;
  /**
   * Built-in `newSession` spy. When a command calls `ctx.newSession()`,
   * this spy creates a real `SessionManager.inMemory()`, runs the
   * `setup()` callback on it, and returns `{ cancelled: false }`.
   */
  newSession: ExtensionCommandContext["newSession"];
  /**
   * Spy for `ReplacedSessionContext.sendMessage`. Calls persist a
   * `CustomMessageEntry` to the most recent child `SessionManager` (mirroring
   * production) so tests can assert on child entries, and record `options`
   * (e.g. `triggerTurn`) via normal vi.fn call tracking.
   */
  sendMessage: ReturnType<typeof vi.fn>;
  /**
   * Returns the `SessionManager` that was created for the most recent
   * child session (from the `newSession` spy), or `undefined` if no
   * child session has been created yet.
   */
  getChildSessionManager(): SessionManager | undefined;
  /** Look up a registered command by name and get an executor. */
  command(name: string): CommandHandle;
  /** Look up a registered tool by name and get an executor. */
  tool(name: string): ToolHandle;
  /** All registered command names. */
  listRegisteredCommands(): string[];
  /** All registered tool names. */
  listRegisteredTools(): string[];
}

export interface CommandHandle {
  registered: RegisteredCommand;
  execute(
    args?: string,
    overrides?: CommandContextOverrides,
  ): Promise<ExtensionCommandContext>;
}

export interface ToolHandle {
  /** The ToolDefinition that was registered (has execute, renderCall, etc). */
  registered: ToolDefinition;
  execute(
    params: unknown,
    options?: ToolExecuteOptions,
  ): Promise<AgentToolResult<unknown>>;
}

export interface ToolExecuteOptions extends ToolContextOverrides {
  signal?: AbortSignal;
  onUpdate?: AgentToolUpdateCallback<unknown>;
}

export interface PiTestHarnessOptions {
  cwd?: string;
  extensionPath?: string;
  /**
   * Default context overrides applied to every command execution.
   * Per-call overrides passed to `execute()` merge on top, with UI
   * overrides deep-merged so harness-level and per-call spies coexist.
   */
  context?: CommandContextOverrides;
  /** Overrides for the tool execution context. */
  toolContext?: ToolContextOverrides;
}

/**
 * Create a test harness that loads an extension factory through real Pi
 * internals. The returned harness lets you execute registered commands and
 * tools with spy-based contexts.
 *
 * Context overrides set here become defaults for all command executions.
 * The harness includes a built-in `newSession` spy that creates real
 * in-memory session managers for child sessions. Access the most recent
 * child via `getChildSessionManager()`.
 */
export async function createPiTestHarness(
  factory: ExtensionFactory,
  options: PiTestHarnessOptions = {},
): Promise<PiTestHarness> {
  const cwd = options.cwd ?? mkdtempSync(join(tmpdir(), "pi-test-cwd-"));
  const harnessContext = options.context ?? {};
  const eventBus = createEventBus();
  const runtime = createExtensionRuntime();

  const extension = await loadExtensionFromFactory(
    factory,
    cwd,
    eventBus,
    runtime,
    options.extensionPath ?? "<test-extension>",
  );

  // Built-in newSession spy: creates a real child SessionManager and runs
  // the setup callback, so tests can inspect entries written to the child.
  // Also invokes withSession if provided, with a context that mirrors the
  // replacement-session ctx (fresh ui spies etc).
  let childSm: SessionManager | undefined;
  // sendMessage spy persisted to the child SessionManager, mirroring how
  // production ReplacedSessionContext.sendMessage lands CustomMessageEntries.
  // Typed loosely (content/details as unknown) to avoid coupling tests to
  // TextContent/ImageContent unions; the child SessionManager accepts the
  // values as-is at runtime.
  const sendMessage = vi.fn(
    async (
      message: {
        customType: string;
        content: unknown;
        display: boolean;
        details?: unknown;
      },
      options?: {
        triggerTurn?: boolean;
        deliverAs?: "steer" | "followUp" | "nextTurn";
      },
    ) => {
      if (!childSm) return;
      childSm.appendCustomMessageEntry(
        message.customType,
        message.content as string,
        message.display,
        message.details,
      );
      void options;
    },
  );
  const newSession = vi.fn(
    async (opts?: Parameters<ExtensionCommandContext["newSession"]>[0]) => {
      childSm = SessionManagerClass.inMemory();
      if (opts?.setup) {
        await opts.setup(childSm);
      }
      if (opts?.withSession) {
        // NOTE: replacementCtx is built from harness defaults, but bound to
        // childSm so ReplacedSessionContext.sessionManager reads/writes land
        // on the same child the setup callback saw. In production, withSession
        // receives a ReplacedSessionContext tied to the new session.
        const replacementCtx = createCommandContext({
          cwd,
          ...harnessContext,
          sessionManager: childSm,
          ui: { ...harnessContext.ui },
        });
        // ReplacedSessionContext extends ExtensionCommandContext but is not
        // publicly exported, so we attach the sendMessage spy via cast.
        (
          replacementCtx as unknown as { sendMessage: typeof sendMessage }
        ).sendMessage = sendMessage;
        await opts.withSession(
          replacementCtx as Parameters<NonNullable<typeof opts.withSession>>[0],
        );
      }
      return { cancelled: false };
    },
  ) as unknown as ExtensionCommandContext["newSession"];

  let toolCallCounter = 0;

  function command(name: string): CommandHandle {
    const registered = extension.commands.get(name);
    if (!registered) {
      const available = [...extension.commands.keys()].join(", ");
      throw new Error(
        `Command "${name}" is not registered. Registered: [${available}]`,
      );
    }
    return {
      registered,
      async execute(
        args = "",
        overrides: CommandContextOverrides = {},
      ): Promise<ExtensionCommandContext> {
        const ctx = createCommandContext({
          cwd,
          newSession,
          ...harnessContext,
          ...overrides,
          // Deep-merge UI so harness-level and per-call spies coexist.
          ui: { ...harnessContext.ui, ...overrides.ui },
        });
        await registered.handler(args, ctx);
        return ctx;
      },
    };
  }

  function tool(name: string): ToolHandle {
    const entry = extension.tools.get(name);
    if (!entry) {
      const available = [...extension.tools.keys()].join(", ");
      throw new Error(
        `Tool "${name}" is not registered. Registered: [${available}]`,
      );
    }
    const definition = entry.definition;
    return {
      registered: definition,
      execute(
        params: unknown,
        { signal, onUpdate, ...overrides }: ToolExecuteOptions = {},
      ) {
        const id = `tc_${++toolCallCounter}`;
        const ctx = createToolContext({
          cwd,
          ...options.toolContext,
          ...overrides,
        });
        return definition.execute(
          id,
          params as Record<string, unknown>,
          signal,
          onUpdate,
          ctx,
        );
      },
    };
  }

  return {
    cwd,
    extension,
    runtime,
    newSession,
    sendMessage,
    getChildSessionManager: () => childSm,
    command,
    tool,
    listRegisteredCommands: () => [...extension.commands.keys()],
    listRegisteredTools: () => [...extension.tools.keys()],
  };
}
