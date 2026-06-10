import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  type ExtensionAPI,
  type ExtensionContext,
  type SessionEntry,
  type SessionHeader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
} from "@harness/events";
import { buildSessionMarkdown } from "./markdown";

interface ExportableSessionManager {
  getBranch(): SessionEntry[];
  getHeader(): SessionHeader | null;
  getSessionFile(): string | undefined;
  getSessionId(): string;
}

export default function (pi: ExtensionAPI) {
  pi.registerFlag("export-md", {
    description:
      "Export a session file or session ID active branch to Markdown and exit",
    type: "string",
  });

  pi.registerCommand("export:md", {
    description: "Export the active branch to Markdown",
    handler: async (args, ctx) => {
      const outputPath = await exportMarkdown(ctx, args.trim() || undefined);
      ctx.ui.notify(`Exported Markdown to ${outputPath}`, "info");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    const flag = pi.getFlag("export-md");
    if (typeof flag !== "string" || !flag.trim()) return;

    try {
      const sessionPath = await resolveSessionPath(
        flag.trim(),
        ctx.cwd,
        ctx.sessionManager.getSessionDir(),
      );
      const sessionManager = SessionManager.open(sessionPath);
      const outputPath = await exportMarkdownFromManager(
        ctx,
        sessionManager,
        undefined,
      );
      if (ctx.hasUI)
        ctx.ui.notify(`Exported Markdown to ${outputPath}`, "info");
      else console.log(outputPath);
    } finally {
      ctx.shutdown();
    }
  });

  const off = pi.events.on(AD_HEADER_COLLECT_EVENT, () => {
    off();
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "export:md",
      description: "export session to markdown",
    });
  });
}

async function exportMarkdown(
  ctx: ExtensionContext,
  outputArg: string | undefined,
): Promise<string> {
  return exportMarkdownFromManager(ctx, ctx.sessionManager, outputArg);
}

async function exportMarkdownFromManager(
  ctx: ExtensionContext,
  sessionManager: ExportableSessionManager,
  outputArg: string | undefined,
): Promise<string> {
  const entries = sessionManager.getBranch();
  if (entries.length === 0) {
    throw new Error("Nothing to export yet - start a conversation first");
  }

  const outputPath = resolveOutputPath(ctx, sessionManager, outputArg);
  const markdown = buildSessionMarkdown({
    header: sessionManager.getHeader(),
    entries,
    sessionId: sessionManager.getSessionId() || "unknown-session",
    exportedAt: new Date(),
  });

  await writeFile(outputPath, markdown, "utf8");
  return outputPath;
}

async function resolveSessionPath(
  sessionArg: string,
  cwd: string,
  sessionDir: string,
): Promise<string> {
  if (
    sessionArg.includes("/") ||
    sessionArg.includes("\\") ||
    sessionArg.endsWith(".jsonl")
  ) {
    return resolve(cwd, sessionArg);
  }

  const localSessions = await SessionManager.list(cwd, sessionDir);
  const localMatch = localSessions.find((session) =>
    session.id.startsWith(sessionArg),
  );
  if (localMatch) return localMatch.path;

  const allSessions = await SessionManager.listAll();
  const globalMatch = allSessions.find((session) =>
    session.id.startsWith(sessionArg),
  );
  if (globalMatch) return globalMatch.path;

  throw new Error(`No session found matching '${sessionArg}'`);
}

function resolveOutputPath(
  ctx: ExtensionContext,
  sessionManager: ExportableSessionManager,
  outputArg: string | undefined,
): string {
  if (outputArg) return resolve(ctx.cwd, outputArg);

  const sessionFile = sessionManager.getSessionFile();
  const sessionBasename = sessionFile
    ? basename(sessionFile, ".jsonl")
    : sessionManager.getSessionId() || "ephemeral";
  return resolve(ctx.cwd, `pi-session-${sessionBasename}.md`);
}
