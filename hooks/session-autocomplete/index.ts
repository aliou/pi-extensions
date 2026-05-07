/**
 * `@@` session autocomplete provider.
 *
 * On `@@<token>` in the input editor, searches the Sesame index for sessions
 * matching the token (or lists recent sessions for bare `@@`). On accept, the
 * completion inserts `@@<uuid>`. The `@@<uuid>` marker stays in the user
 * message and is resolved to hidden context in `before_agent_start`.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openSesameDb, resolveSessionRefFromDb } from "./db";
import { createSessionAutocompleteProvider } from "./provider";
import { tildePath } from "./search";
import { AT_UUID_RE, type ResolvedRef } from "./types";

/** Pending `@@<uuid>` refs resolved during `input`, consumed in `before_agent_start`. */
// TODO:  this is not needed, the before_agent_start includes the prompt, and so we can deduce the refs from there.
let pendingRefs: ResolvedRef[] = [];

export default async function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const currentSessionId = ctx.sessionManager.getSessionId();
    const cwd = ctx.cwd;

    ctx.ui.addAutocompleteProvider((current) =>
      createSessionAutocompleteProvider(current, cwd, currentSessionId),
    );
  });

  // On `input`, resolve `@@<uuid>` markers via DB
  pi.on("input", async (event) => {
    const text = event.text;
    const db = openSesameDb();
    if (!db) {
      pendingRefs = [];
      return { action: "continue" } as const;
    }

    try {
      const refs: ResolvedRef[] = [];
      const seen = new Set<string>();

      const re = new RegExp(AT_UUID_RE.source, "g");
      let match: RegExpExecArray | null = re.exec(text);
      while (match !== null) {
        const sessionId = match[1];
        if (sessionId && !seen.has(sessionId)) {
          seen.add(sessionId);
          const ref = resolveSessionRefFromDb(db, sessionId);
          if (ref) {
            refs.push(ref);
          }
        }
        match = re.exec(text);
      }

      pendingRefs = refs;
    } finally {
      db.close();
    }

    // Text is NOT modified — `@@<uuid>` stays as-is in the user message
    return { action: "continue" } as const;
  });

  // On `before_agent_start`, inject hidden context for resolved refs
  pi.on("before_agent_start", async () => {
    if (pendingRefs.length === 0) return;

    const lines = pendingRefs.map((ref) => {
      const name = ref.name || "(untitled)";
      const cwdDisplay = tildePath(ref.cwd);
      return `- session ${ref.id}: name="${name}", cwd=${cwdDisplay}, created=${ref.created}, modified=${ref.modified}\n  Use read_session({ sessionId: "${ref.id}", goal: "..." }) to access its content.`;
    });

    const content = `The user referenced the following sessions:\n${lines.join("\n")}`;

    pendingRefs = [];

    return {
      message: {
        customType: "breadcrumbs:session-ref",
        content,
        display: false,
      },
    } as const;
  });
}
