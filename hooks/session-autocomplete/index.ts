/**
 * `@@` session autocomplete provider.
 *
 * On `@@<token>` in the input editor, searches the Sesame index for sessions
 * matching the token (or lists recent sessions for bare `@@`). On accept, the
 * completion inserts `@@<uuid>`. The `@@<uuid>` marker stays in the user
 * message and is resolved to a runtime instruction appended to the input.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { openSesameDb, resolveSessionRefFromDb } from "./db";
import { createSessionAutocompleteProvider } from "./provider";
import { tildePath } from "./search";
import { AT_UUID_RE, type ResolvedRef } from "./types";

function buildSessionRefsInstruction(refs: ResolvedRef[]): string {
  const lines = refs.map((ref) => {
    const name = ref.name || "(untitled)";
    const cwdDisplay = tildePath(ref.cwd);
    return `  <session id="${ref.id}" name="${name}" cwd="${cwdDisplay}" created="${ref.created}" modified="${ref.modified}">
    Use read_session({ sessionId: "${ref.id}", goal: "..." }) to access its content.
  </session>`;
  });

  return `

<pi_runtime_instruction source="session_autocomplete" user_visible="false">
  This instruction was inserted by the Pi session-autocomplete extension, not by the user.
  The user message is above this block.
  The user referenced the following sessions:
${lines.join("\n")}
</pi_runtime_instruction>`;
}

export default async function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const currentSessionId = ctx.sessionManager.getSessionId();
    const cwd = ctx.cwd;

    ctx.ui.addAutocompleteProvider((current) =>
      createSessionAutocompleteProvider(current, cwd, currentSessionId),
    );
  });

  // On `input`, resolve `@@<uuid>` markers via DB and append tool guidance.
  pi.on("input", async (event) => {
    const text = event.text;
    const db = openSesameDb();
    if (!db) return { action: "continue" } as const;

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
          if (ref) refs.push(ref);
        }
        match = re.exec(text);
      }

      if (refs.length === 0) return { action: "continue" } as const;

      return {
        action: "transform",
        text: text + buildSessionRefsInstruction(refs),
      } as const;
    } finally {
      db.close();
    }
  });
}
