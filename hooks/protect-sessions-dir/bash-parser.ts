/**
 * Bash AST parsing and path extraction.
 *
 * Parses bash commands to find candidate file paths that reference
 * the sessions directory. Used by the protect-sessions-dir hook
 * to gate direct bash access to session files.
 */

import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type {
  Command,
  DblQuoted,
  Program,
  Statement,
  Word,
  WordPart,
} from "@aliou/sh";
import { parse } from "@aliou/sh";
import type { SessionAccessRequest } from "./types";

/**
 * Extract session-dir paths from a bash command string by parsing the AST.
 */
export function extractBashTargets(
  command: string,
  isInSessionsDir: (p: string) => boolean,
): SessionAccessRequest {
  const paths = extractPathsFromBashCommand(command);
  const sessionPaths = paths.filter(isInSessionsDir);

  if (sessionPaths.length > 0) {
    return { targets: sessionPaths, displayTarget: command, ambiguous: false };
  }

  // Zero paths extracted — check for ambiguous references.
  if (command.includes("/.pi/agent/sessions")) {
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
export function looksLikePath(s: string): boolean {
  return s.startsWith("/") || s.startsWith("~") || s.includes("/");
}
