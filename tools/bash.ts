import { homedir as getHomedir } from "node:os";
import { resolve } from "node:path";
import type {
  AgentToolResult,
  BashSpawnContext,
  ExtensionAPI,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import {
  createBashTool,
  DEFAULT_MAX_BYTES,
  formatSize,
  keyHint,
  truncateToVisualLines,
} from "@mariozechner/pi-coding-agent";
import { Box, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

/** Lines to show when collapsed. Matches the native bash tool. */
const BASH_PREVIEW_LINES = 5;

const AD_BASH_SPAWN_HOOK_REQUEST_EVENT = "ad:bash:spawn-hook:request";

type SpawnHookContributor = {
  id: string;
  priority?: number;
  spawnHook: (ctx: BashSpawnContext) => BashSpawnContext;
};

type SpawnHookRequestPayload = {
  register: (contributor: SpawnHookContributor) => void;
};

const homedir = getHomedir();
/**
 * Override the built-in bash tool to add a cwd parameter.
 *
 * Models often use `cd dir && command` which silently skips the command
 * if the directory doesn't exist. The cwd parameter is passed to spawn()
 * which fails explicitly if the directory is missing.
 */
export function setupBashTool(pi: ExtensionAPI): void {
  const cwd = process.cwd();
  const nativeBash = createBashTool(cwd);

  const contributors = new Map<string, SpawnHookContributor>();
  const getContributors = () =>
    Array.from(contributors.values()).sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
    );

  const registerContributor = (contributor: SpawnHookContributor) => {
    contributors.set(contributor.id, contributor);
  };

  const composedSpawnHook = (ctx: BashSpawnContext): BashSpawnContext => {
    let next = ctx;
    for (const contributor of getContributors()) {
      next = contributor.spawnHook(next);
    }
    return next;
  };

  const schema = Type.Object({
    command: Type.String({ description: "Bash command to execute" }),
    timeout: Type.Optional(Type.Number({ description: "Timeout in seconds" })),
    cwd: Type.Optional(
      Type.String({
        description: "Working directory. Use instead of 'cd dir && command'.",
      }),
    ),
  });

  pi.registerTool({
    ...nativeBash,
    parameters: schema,
    promptGuidelines: [
      "Use the cwd parameter instead of 'cd dir && command'.",
      "Reserve bash for git, build/test, package managers, ssh, curl, and process management.",
      "Prefer native tools like read, find, grep, edit, and write over shell commands when available.",
    ],
    renderCall(args, theme) {
      const command = args.command ?? "";
      const timeout = args.timeout as number | undefined;
      const cwdArg = args.cwd as string | undefined;

      const commandDisplay = command ? command : theme.fg("toolOutput", "...");
      const cwdDisplay = cwdArg?.startsWith(homedir)
        ? `~${cwdArg.slice(homedir.length)}`
        : cwdArg;
      const cwdSuffix = cwdDisplay
        ? theme.fg("muted", ` (cwd: ${cwdDisplay})`)
        : "";
      const timeoutSuffix = timeout
        ? theme.fg("muted", ` (timeout ${timeout}s)`)
        : "";

      return new Text(
        `${theme.fg("toolTitle", theme.bold(`$ ${commandDisplay}`))}${cwdSuffix}${timeoutSuffix}`,
        0,
        0,
      );
    },
    renderResult(
      result: AgentToolResult<Record<string, unknown>>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const box = new Box(0, 0);
      const output = getTextOutput(result);

      if (output) {
        const styledOutput = output
          .split("\n")
          .map((line: string) => theme.fg("toolOutput", line))
          .join("\n");

        if (options.expanded) {
          box.addChild(new Text(`\n${styledOutput}`, 0, 0));
        } else {
          // Visual line truncation with width-aware caching (matches native)
          let cachedWidth: number | undefined;
          let cachedLines: string[] | undefined;
          let cachedSkipped: number | undefined;

          box.addChild({
            render: (width: number) => {
              if (cachedLines === undefined || cachedWidth !== width) {
                const r = truncateToVisualLines(
                  styledOutput,
                  BASH_PREVIEW_LINES,
                  width,
                );
                cachedLines = r.visualLines;
                cachedSkipped = r.skippedCount;
                cachedWidth = width;
              }
              if (cachedSkipped && cachedSkipped > 0) {
                const hint = `${theme.fg("muted", `... (${cachedSkipped} earlier lines,`)} ${keyHint("app.tools.expand", "to expand")})`;
                return [
                  "",
                  truncateToWidth(hint, width, "..."),
                  ...cachedLines,
                ];
              }
              return ["", ...cachedLines];
            },
            invalidate: () => {
              cachedWidth = undefined;
              cachedLines = undefined;
              cachedSkipped = undefined;
            },
          });
        }
      }

      // Truncation warnings
      const details = result.details as Record<string, unknown> | undefined;
      const truncation = details?.truncation as
        | Record<string, unknown>
        | undefined;
      const fullOutputPath = details?.fullOutputPath as string | undefined;
      if (truncation?.truncated || fullOutputPath) {
        const warnings: string[] = [];
        if (fullOutputPath) {
          warnings.push(`Full output: ${fullOutputPath}`);
        }
        if (truncation?.truncated) {
          if (truncation.truncatedBy === "lines") {
            warnings.push(
              `Truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`,
            );
          } else {
            warnings.push(
              `Truncated: ${truncation.outputLines} lines shown (${formatSize((truncation.maxBytes as number) ?? DEFAULT_MAX_BYTES)} limit)`,
            );
          }
        }
        box.addChild(
          new Text(
            `\n${theme.fg("warning", `[${warnings.join(". ")}]`)}`,
            0,
            0,
          ),
        );
      }

      // Elapsed / Took duration
      const durationMs = details?._durationMs as number | undefined;
      if (!options.isPartial && durationMs !== undefined) {
        box.addChild(
          new Text(
            `\n${theme.fg("muted", `Took ${(durationMs / 1000).toFixed(1)}s`)}`,
            0,
            0,
          ),
        );
      }

      return box;
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const effectiveCwd = params.cwd ? resolve(ctx.cwd, params.cwd) : ctx.cwd;
      const bashForCwd = createBashTool(effectiveCwd, {
        spawnHook: composedSpawnHook,
      });
      const start = Date.now();
      const result = await bashForCwd.execute(
        toolCallId,
        { command: params.command, timeout: params.timeout },
        signal,
        onUpdate,
      );
      // Attach duration to details so renderResult can display it
      const durationMs = Date.now() - start;
      result.details = { ...result.details, _durationMs: durationMs };
      return result;
    },
  });

  // Request hook contributors from other extensions.
  const requestContributors = () => {
    pi.events.emit(AD_BASH_SPAWN_HOOK_REQUEST_EVENT, {
      register: registerContributor,
    } satisfies SpawnHookRequestPayload);
  };

  // Fire once at setup and once on session start to avoid load-order misses.
  requestContributors();
  pi.on("session_start", () => {
    requestContributors();
  });
}

const ESC = "\u001B";
const OSC_REGEX = new RegExp(`${ESC}\\][\\s\\S]*?(?:\\u0007|${ESC}\\\\)`, "g");
const CSI_REGEX = new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, "g");
const SINGLE_ESC_REGEX = new RegExp(`${ESC}[@-_]`, "g");
const C1_ST_REGEX = /\u009C/g;

/**
 * Remove terminal escape/control sequences that leak into tool output UI.
 * Mirrors native bash rendering behavior in pi-mono (strip + sanitize).
 */
function sanitizeShellOutput(value: string): string {
  let text = value;

  // OSC sequences: ESC ] ... BEL or ESC \\
  text = text.replace(OSC_REGEX, "");
  // CSI/SGR and other control sequences: ESC [ ... command
  text = text.replace(CSI_REGEX, "");
  // Other single-character escapes
  text = text.replace(SINGLE_ESC_REGEX, "");
  // Standalone String Terminator and leftover ESC
  text = text.replace(C1_ST_REGEX, "").replace(new RegExp(ESC, "g"), "");

  // Drop control chars except tab/newline/carriage return.
  return Array.from(text)
    .filter((char) => {
      const code = char.codePointAt(0);
      if (code === undefined) return false;
      if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
      return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
    })
    .join("");
}

/** Extract text content from a tool result. */
function getTextOutput(result: AgentToolResult<unknown>): string {
  const textBlocks = result.content?.filter((c) => c.type === "text") || [];
  return textBlocks
    .map((c) => {
      const text = "text" in c && c.text ? c.text : "";
      return sanitizeShellOutput(text).replace(/\r/g, "");
    })
    .join("\n")
    .trim();
}
