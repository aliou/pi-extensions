import { homedir as getHomedir } from "node:os";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { renderCall, renderResult } from "./render";

const homedir = getHomedir();

/**
 * Override the built-in bash tool to add a cwd parameter.
 *
 * Models often use `cd dir && command` which silently skips the command
 * if the directory doesn't exist. The cwd parameter is passed to spawn()
 * which fails explicitly if the directory is missing.
 */
export default function (pi: ExtensionAPI): void {
  const cwd = process.cwd();
  const nativeBash = createBashTool(cwd);

  const schema = Type.Object({
    command: Type.String({ description: "Bash command to execute" }),
    timeout: Type.Optional(Type.Number({ description: "Timeout in seconds" })),
    cwd: Type.Optional(
      Type.String({
        description:
          "Working directory for the command. Prefer this over shell wrappers like 'cd dir && command', 'pushd', or 'cd ../..; ...'.",
      }),
    ),
  });

  pi.registerTool({
    ...nativeBash,
    parameters: schema,
    promptGuidelines: [
      "bash: When a command should run in another directory, set cwd and keep command free of leading 'cd', 'pushd', or similar directory-changing shell wrappers.",
      "bash: Do not use patterns like 'cd dir && command', 'cd dir; command', or 'pushd dir && command'.",
      "bash: Use the cwd parameter instead of 'cd dir && command'.",
      "bash: Reserve bash for git, build/test, package managers, ssh, curl, and process management.",
      "bash: Prefer native tools like read, find, grep, edit, and write over shell commands when available.",
    ],
    renderCall(args, theme) {
      return renderCall(args, theme, homedir);
    },
    renderResult(result, options, theme) {
      return renderResult(result, options, theme);
    },
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const effectiveCwd = params.cwd ? resolve(ctx.cwd, params.cwd) : ctx.cwd;
      const bashForCwd = createBashTool(effectiveCwd);
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
}
