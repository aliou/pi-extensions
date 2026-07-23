import type {
  ExtensionContext,
  ExtensionUIContext,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { createMock } from "@golevelup/ts-vitest";

interface CreateEvalContextOptions {
  name: string;
  modelRegistry: ModelRegistry;
  sessionId: string;
  signal?: AbortSignal;
}

/** Creates the strict headless Pi context shared by subagent eval harnesses. */
export function createEvalContext(
  options: CreateEvalContextOptions,
): ExtensionContext {
  const sessionManager = createMock<SessionManager>(
    { getSessionId: () => options.sessionId },
    { name: `${options.name}-eval-session`, strict: true },
  );
  const ui = createMock<ExtensionUIContext>(
    { notify: () => {} },
    { name: `${options.name}-eval-ui`, strict: true },
  );
  return createMock<ExtensionContext>(
    {
      cwd: process.cwd(),
      hasUI: false,
      mode: "print",
      modelRegistry: options.modelRegistry,
      sessionManager,
      signal: options.signal,
      ui,
    },
    { name: `${options.name}-eval-context`, strict: true },
  );
}
