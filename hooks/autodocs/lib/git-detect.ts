/**
 * Detect git operations that could advance the default (main) branch, and
 * describe the advancement range after the fact.
 *
 * Parsing uses @aliou/sh (shell AST) rather than string matching, so we
 * correctly handle pipelines, subshells, redirects, and quoted subcommands.
 * The detector is intentionally broad: commit, merge, rebase, pull, push,
 * fetch, reset, cherry-pick, revert, and switch/checkout all qualify. The
 * real filter is the before/after SHA compare on the resolved main branch,
 * which is cheap and exact.
 */

import type {
  Command,
  Pipeline,
  Program,
  SimpleCommand,
  Statement,
  Word,
} from "@aliou/sh";
import { parse } from "@aliou/sh";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { GitAdvancement } from "./types";

/** Subcommands that could advance the default branch. */
const ADVANCING_SUBCOMMANDS = new Set([
  "commit",
  "merge",
  "rebase",
  "pull",
  "push",
  "fetch",
  "reset",
  "cherry-pick",
  "revert",
  "switch",
  "checkout",
]);

/**
 * Whether a bash command string contains a git operation that could advance
 * the default branch. Returns true on any candidate; the caller confirms via
 * a SHA compare.
 */
export function couldAdvanceMain(command: string): boolean {
  let ast: Program;
  try {
    ast = parse(command, { dialect: "bash" }).ast;
  } catch {
    // Unparseable -> be conservative and let the SHA compare decide. We still
    // return true so a snapshot is taken; if it doesn't parse, the snapshot
    // step itself is harmless.
    return /\bgit\b/.test(command);
  }

  for (const stmt of ast.body) {
    if (statementAdvancesMain(stmt)) return true;
  }
  return false;
}

function statementAdvancesMain(stmt: Statement): boolean {
  return commandAdvancesMain(stmt.command);
}

function commandAdvancesMain(cmd: Command): boolean {
  switch (cmd.type) {
    case "SimpleCommand":
      return simpleCommandAdvancesMain(cmd);
    case "Pipeline":
      return (cmd as Pipeline).commands.some((c) => statementAdvancesMain(c));
    case "Logical":
      return (
        statementAdvancesMain(cmd.left) || statementAdvancesMain(cmd.right)
      );
    case "Subshell":
    case "Block":
      return cmd.body.some((c) => statementAdvancesMain(c));
    case "IfClause":
      if (cmd.then.some((c) => statementAdvancesMain(c))) return true;
      return cmd.else?.some((c) => statementAdvancesMain(c)) ?? false;
    case "WhileClause":
      return cmd.body.some((c) => statementAdvancesMain(c));
    case "ForClause":
      return cmd.body.some((c) => statementAdvancesMain(c));
    default:
      return false;
  }
}

function simpleCommandAdvancesMain(cmd: SimpleCommand): boolean {
  const words = cmd.words ?? [];
  if (words.length === 0) return false;

  // The parser separates leading VAR=value assignments into cmd.assignments,
  // so words[0] is the command name.
  const nameWord = words[0];
  const name = nameWord ? reconstructWord(nameWord) : null;
  if (name !== "git") return false;

  // Scan the remaining words for an advancing subcommand. Intentionally
  // over-inclusive: a flag argument could coincidentally match a subcommand
  // name (e.g. `git log --grep merge`), but a false positive is harmless — the
  // before/after SHA compare is the real filter, and it is cheap. Crucially,
  // this also handles `git -C ../repo pull`, where the subcommand is not the
  // first non-flag word.
  for (let j = 1; j < words.length; j++) {
    const w = words[j];
    if (!w) continue;
    const reconstructed = reconstructWord(w);
    if (reconstructed && ADVANCING_SUBCOMMANDS.has(reconstructed)) return true;
  }
  return false;
}

/**
 * Reconstruct a Word into a plain string. Returns null if any part cannot be
 * resolved (param expansion, command substitution, etc.).
 */
function reconstructWord(word: Word): string | null {
  let result = "";
  for (const part of word.parts) {
    switch (part.type) {
      case "Literal":
        result += part.value;
        break;
      case "SglQuoted":
        result += part.value;
        break;
      case "DblQuoted":
        for (const sub of part.parts) {
          if (sub.type === "Literal" || sub.type === "SglQuoted") {
            result += sub.value;
          } else {
            return null;
          }
        }
        break;
      default:
        // ParamExp, CmdSubst, ArithExp, ProcSubst, BraceExp, ExtGlob -> unknown.
        return null;
    }
  }
  return result;
}

/** Snapshot the short SHA of the given branch ref, or undefined. */
export async function snapshotMainSha(
  pi: ExtensionAPI,
  cwd: string,
  branch: string,
): Promise<string | undefined> {
  const result = await pi.exec("git", ["rev-parse", "--short", branch], {
    cwd,
  });
  if (result.code !== 0) return undefined;
  const sha = result.stdout.trim();
  return sha || undefined;
}

/**
 * Describe the advancement from one SHA to another.
 * Returns undefined if the range is empty or invalid.
 */
export async function describeAdvancement(
  pi: ExtensionAPI,
  cwd: string,
  fromSha: string,
  toSha: string,
): Promise<GitAdvancement | undefined> {
  if (!fromSha || !toSha || fromSha === toSha) return undefined;

  const count = await pi.exec(
    "git",
    ["rev-list", "--count", `${fromSha}..${toSha}`],
    { cwd },
  );
  const commits =
    count.code === 0 ? Number.parseInt(count.stdout.trim(), 10) || 0 : 0;
  if (commits === 0) return undefined;

  const stat = await pi.exec(
    "git",
    ["diff", "--shortstat", `${fromSha}..${toSha}`],
    { cwd },
  );
  const { additions, deletions } = parseShortstat(stat.stdout);

  return { fromSha, toSha, commits, additions, deletions };
}

/** Parse `git diff --shortstat` output into additions/deletions. */
function parseShortstat(stdout: string): {
  additions: number;
  deletions: number;
} {
  let additions = 0;
  let deletions = 0;
  const ins = /(\d+) insertion/.exec(stdout);
  const del = /(\d+) deletion/.exec(stdout);
  if (ins) additions = Number.parseInt(ins[1] ?? "", 10) || 0;
  if (del) deletions = Number.parseInt(del[1] ?? "", 10) || 0;
  return { additions, deletions };
}
