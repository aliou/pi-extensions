/**
 * Prevent direct agent access to the sessions directory.
 *
 * Gates read, write, edit, and bash commands that target session files.
 * Agents should use find_sessions and read_session tools instead.
 *
 * Unified gating: both file tools and bash go through the same approval
 * mechanism — `allowAll` flag and `approvedSubtrees` path set.
 * write/edit are hard-blocked unconditionally.
 */

import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type {
  Command,
  DblQuoted,
  Program,
  Statement,
  Word,
  WordPart,
} from "@aliou/sh";
import { parse } from "@aliou/sh";
import { AD_NOTIFY_ATTENTION_EVENT } from "@harness/events";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import {
  Container,
  Key,
  matchesKey,
  Spacer,
  Text,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionAccessRequest = {
  /** Absolute session-dir paths extracted from the tool call. */
  targets: string[];
  /** Path or command string shown in the dialog and events. */
  displayTarget: string;
  /** True when no specific paths could be extracted (e.g. variable expansion). */
  ambiguous: boolean;
};

type SessionGateResult = "allow-once" | "allow-path" | "allow-all" | "deny";

// ---------------------------------------------------------------------------
// Approval state (module scope, per Pi runtime)
// ---------------------------------------------------------------------------

let allowAll = false;
const approvedSubtrees = new Set<string>();

/** @internal Reset approval state for testing. */
export function _resetForTesting(): void {
  allowAll = false;
  approvedSubtrees.clear();
}

// ---------------------------------------------------------------------------
// Session dir helpers
// ---------------------------------------------------------------------------

function getSessionsDir(): string {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, "sessions");
}

/**
 * Check if a resolved absolute path falls within the sessions directory.
 */
function isInSessionsDir(path: string): boolean {
  const sessionsDir = getSessionsDir();
  const absolutePath = resolve(path);
  const rel = relative(sessionsDir, absolutePath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Check if a path is covered by any approved subtree.
 */
function isApprovedPath(targetPath: string): boolean {
  if (allowAll) return true;
  for (const approved of approvedSubtrees) {
    const rel = relative(approved, resolve(targetPath));
    if (rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOCK_MESSAGE =
  "Direct access to session files is restricted. " +
  "Prefer find_sessions + read_session. " +
  "Direct reads may be allowed via runtime toggle or explicit user confirmation.";

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

function emitSessionGateEvent(
  pi: ExtensionAPI,
  description: string,
  command = "",
  toolName?: string,
  toolCallId?: string,
): void {
  const payload = {
    source: "breadcrumbs:protect-sessions-dir",
    command,
    description,
    toolName,
    toolCallId,
  };
  pi.events.emit(AD_NOTIFY_ATTENTION_EVENT, payload);
}

// ---------------------------------------------------------------------------
// Target extraction
// ---------------------------------------------------------------------------

/**
 * Extract session-dir targets from a tool call.
 */
function extractSessionTargets(
  toolName: string,
  input: Record<string, unknown>,
): SessionAccessRequest {
  if (toolName === "bash") {
    return extractBashTargets(String(input.command ?? ""));
  }

  // File tools: read, write, edit
  const rawPath = String(input.path ?? input.file_path ?? "");
  if (!rawPath) {
    return { targets: [], displayTarget: "", ambiguous: false };
  }

  if (isAbsolute(rawPath)) {
    const resolvedPath = resolve(rawPath);
    if (isInSessionsDir(resolvedPath)) {
      return {
        targets: [resolvedPath],
        displayTarget: resolvedPath,
        ambiguous: false,
      };
    }
    return { targets: [], displayTarget: "", ambiguous: false };
  }

  // Relative path containing sessions dir reference — suspicious, block.
  if (rawPath.includes("/.pi/agent/sessions")) {
    return { targets: [], displayTarget: rawPath, ambiguous: true };
  }

  // Relative path without sessions dir reference — not gated.
  return { targets: [], displayTarget: "", ambiguous: false };
}

/**
 * Extract session-dir paths from a bash command string by parsing the AST.
 */
function extractBashTargets(command: string): SessionAccessRequest {
  const paths = extractPathsFromBashCommand(command);
  const sessionPaths = paths.filter((p) => isInSessionsDir(p));

  if (sessionPaths.length > 0) {
    return { targets: sessionPaths, displayTarget: command, ambiguous: false };
  }

  // Zero paths extracted — check for ambiguous references.
  const sessionsDir = getSessionsDir();
  if (
    command.includes(sessionsDir) ||
    command.includes("/.pi/agent/sessions")
  ) {
    return { targets: [], displayTarget: command, ambiguous: true };
  }

  return { targets: [], displayTarget: "", ambiguous: false };
}

/**
 * Parse a bash command and extract candidate file paths from the AST.
 */
function extractPathsFromBashCommand(command: string): string[] {
  let ast: Program;
  try {
    ast = parse(command, { dialect: "bash" }).ast;
  } catch {
    return [];
  }

  const candidates: string[] = [];
  for (const stmt of ast.body) {
    collectPathsFromStatement(stmt, candidates);
  }

  const resolved: string[] = [];
  for (const c of candidates) {
    const expanded = c.startsWith("~") ? join(homedir(), c.slice(1)) : c;
    if (isAbsolute(expanded)) resolved.push(resolve(expanded));
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// AST walkers
// ---------------------------------------------------------------------------

function collectPathsFromStatement(stmt: Statement, out: string[]): void {
  collectPathsFromCommand(stmt.command, out);
}

function collectPathsFromCommand(cmd: Command, out: string[]): void {
  switch (cmd.type) {
    case "SimpleCommand": {
      const words = cmd.words ?? [];
      // Skip first word — it's the command name.
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if (!word) continue;
        const reconstructed = reconstructWord(word);
        if (reconstructed && looksLikePath(reconstructed))
          out.push(reconstructed);
      }
      // Redirect targets.
      for (const redir of cmd.redirects ?? []) {
        if (redir.target) {
          const target = reconstructWord(redir.target);
          if (target && looksLikePath(target)) out.push(target);
        }
      }
      break;
    }
    case "Pipeline":
      for (const sub of cmd.commands) collectPathsFromStatement(sub, out);
      break;
    case "Logical":
      collectPathsFromStatement(cmd.left, out);
      collectPathsFromStatement(cmd.right, out);
      break;
    case "Subshell":
    case "Block":
      for (const sub of cmd.body) collectPathsFromStatement(sub, out);
      break;
    case "IfClause":
      for (const sub of cmd.then) collectPathsFromStatement(sub, out);
      if (cmd.else)
        for (const sub of cmd.else) collectPathsFromStatement(sub, out);
      break;
    case "WhileClause":
      for (const sub of cmd.body) collectPathsFromStatement(sub, out);
      break;
    case "ForClause":
      for (const sub of cmd.body) collectPathsFromStatement(sub, out);
      break;
    // Skip FunctionDecl, CaseClause, DeclClause, LetClause,
    // CStyleLoop, TimeClause, TestClause, ArithCmd, CoprocClause, SelectClause.
  }
}

/**
 * Reconstruct a Word into a plain string.
 * Returns null if any part is unresolvable (ParamExp, CmdSubst, etc.).
 */
function reconstructWord(word: Word): string | null {
  let result = "";
  for (const part of word.parts) {
    const s = reconstructWordPart(part);
    if (s === null) return null;
    result += s;
  }
  return result;
}

/**
 * Reconstruct a single WordPart. Returns null for unresolvable parts.
 */
function reconstructWordPart(part: WordPart): string | null {
  switch (part.type) {
    case "Literal":
      return part.value;
    case "SglQuoted":
      return part.value;
    case "DblQuoted":
      return reconstructDblQuoted(part);
    case "ParamExp":
    case "CmdSubst":
    case "ArithExp":
    case "ProcSubst":
      return null;
    default:
      return null;
  }
}

/**
 * Reconstruct a double-quoted word. Returns null if any sub-part is
 * unresolvable (ParamExp, CmdSubst, etc.).
 */
function reconstructDblQuoted(part: DblQuoted): string | null {
  let result = "";
  for (const sub of part.parts) {
    const s = reconstructWordPart(sub);
    if (s === null) return null;
    result += s;
  }
  return result;
}

/**
 * Heuristic: does a string look like a file path?
 */
function looksLikePath(s: string): boolean {
  return s.startsWith("/") || s.startsWith("~") || s.includes("/");
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

/**
 * Show a styled confirmation dialog for session file access.
 */
async function showSessionGateDialog(
  ctx: ExtensionContext,
  description: string,
  target: string,
  ambiguous: boolean,
): Promise<SessionGateResult> {
  const hintText = ambiguous
    ? "y/enter: allow once | a: allow all session access | n/esc: deny"
    : "y/enter: allow once | p: allow this directory for session | a: allow all session access | n/esc: deny";

  const result = await ctx.ui.custom<SessionGateResult>(
    (_tui, theme, _kb, done) => {
      const container = new Container();
      const warnBorder = (s: string) => theme.fg("warning", s);

      container.addChild(new DynamicBorder(warnBorder));
      container.addChild(
        new Text(theme.fg("warning", theme.bold("Session File Access")), 1, 0),
      );
      container.addChild(new Spacer(1));
      container.addChild(
        new Text(
          theme.fg("text", `The agent is trying to ${description}.`),
          1,
          0,
        ),
      );
      container.addChild(new Spacer(1));

      container.addChild(
        new DynamicBorder((s: string) => theme.fg("muted", s)),
      );
      const targetText = new Text("", 1, 0);
      container.addChild(targetText);
      container.addChild(
        new DynamicBorder((s: string) => theme.fg("muted", s)),
      );

      container.addChild(new Spacer(1));
      container.addChild(
        new Text(
          theme.fg("muted", "Prefer find_sessions + read_session instead."),
          1,
          0,
        ),
      );
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg("dim", hintText), 1, 0));
      container.addChild(new DynamicBorder(warnBorder));

      return {
        render: (width: number) => {
          targetText.setText(
            wrapTextWithAnsi(theme.fg("text", target), width - 4).join("\n"),
          );
          return container.render(width);
        },
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => {
          if (matchesKey(data, Key.enter) || data === "y" || data === "Y") {
            done("allow-once");
            return;
          }
          if (!ambiguous && (data === "p" || data === "P")) {
            done("allow-path");
            return;
          }
          if (data === "a" || data === "A") {
            done("allow-all");
            return;
          }
          if (matchesKey(data, Key.escape) || data === "n" || data === "N") {
            done("deny");
          }
        },
      };
    },
  );

  if (result === undefined) return "deny";
  return result;
}

// ---------------------------------------------------------------------------
// Hook setup
// ---------------------------------------------------------------------------

/**
 * Hook that gates direct access to the sessions directory.
 *
 * Unified flow for all tools:
 * - write/edit: hard-blocked unconditionally
 * - read/bash: check approval state, then prompt via dialog if needed
 *
 * Approval state:
 * - `allowAll`: all session-dir access allowed for runtime
 * - `approvedSubtrees`: specific paths approved for runtime
 */
export default async function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    const input = event.input as Record<string, unknown>;
    const request = extractSessionTargets(event.toolName, input);

    // 1. write/edit — hard-block unconditionally when targeting session dir
    //    Checked first so ambiguous write/edit paths are never silently allowed.
    if (event.toolName === "write" || event.toolName === "edit") {
      if (request.targets.length > 0 || request.ambiguous) {
        emitSessionGateEvent(
          pi,
          `Blocked: direct session file ${event.toolName}`,
          request.displayTarget,
          event.toolName,
          event.toolCallId,
        );
        return { block: true, reason: BLOCK_MESSAGE };
      }
      return; // Non-session write/edit — not gated.
    }

    // 2. No targets, not ambiguous — nothing to gate for read/bash
    if (request.targets.length === 0 && !request.ambiguous) return;

    // 3. Already approved
    if (allowAll) return;
    if (
      request.targets.length > 0 &&
      request.targets.every((t) => isApprovedPath(t))
    )
      return;

    // 4. No UI — block
    if (!ctx.hasUI) {
      emitSessionGateEvent(
        pi,
        "Blocked: session access requires confirmation, but no UI is available",
        request.displayTarget,
        event.toolName,
        event.toolCallId,
      );
      return {
        block: true,
        reason:
          "Direct access to session files requires explicit user confirmation, but no UI is available.",
      };
    }

    // 5. Show dialog
    const description =
      event.toolName === "bash"
        ? request.ambiguous
          ? "may reference session files"
          : "access session files via bash"
        : "read a session file directly";

    emitSessionGateEvent(
      pi,
      `Confirmation required: ${description}`,
      request.displayTarget,
      event.toolName,
      event.toolCallId,
    );

    const decision = await showSessionGateDialog(
      ctx,
      description,
      request.displayTarget,
      request.ambiguous,
    );

    if (decision === "deny") {
      return { block: true, reason: "User denied session file access" };
    }
    if (decision === "allow-path") {
      // Store parent directory of each target so sibling files are covered.
      for (const t of request.targets) approvedSubtrees.add(dirname(t));
    }
    if (decision === "allow-all") allowAll = true;

    return; // allow
  });
}
