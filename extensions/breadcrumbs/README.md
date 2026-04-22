# Breadcrumbs

Session history tools for Pi. Search past sessions and extract information from them.

## Tools

### `find_sessions`

Search past Pi sessions by keyword. Returns matching sessions with metadata.

**Parameters:**
- `query` (required): Keyword to search for
- `cwd`: Filter to sessions from a specific working directory
- `after`: Filter to sessions after a date (ISO or relative: `7d`, `2w`, `1m`)
- `before`: Filter to sessions before a date
- `limit`: Max results (default: 10, max: 100)

### `list_sessions`

List recent Pi sessions for a directory.

**Parameters:**
- `cwd` (required): Directory to list sessions for
- `limit`: Max results
- `depth`: How many child-directory levels to include

Use this when you want recent sessions for a project without keyword search.

### `read_session`

Extract information from a past session using a subagent.

**Parameters:**
- `sessionId` (required): Session UUID or file path
- `goal` (required): What information to extract

The subagent has access to session-specific tools (get_session_overview, get_messages, find_messages, etc.) and uses them to answer the goal.

## Commands

- `session:copy-path` - Copy the current session file path to clipboard
- `session:copy-id` - Copy the current session ID to clipboard
- `/spawn [note]` - Create a linked session with parent-session instructions
- `/continue` - Continue work from a linked parent session
- `/label <text>` - Label the current session entry for later navigation

## Session Protection

The extension gates direct agent access to the sessions directory (`~/.pi/agent/sessions`).

- Direct **read** attempts trigger a user confirmation prompt (UI required). Approval is remembered for the rest of the current Pi session.
- Direct **write/edit** attempts remain blocked.
- Direct **bash** commands referencing the sessions directory trigger a user confirmation prompt (UI required). Approval is remembered for the rest of the current Pi session.

Agents should prefer `find_sessions` and `read_session` instead of reading raw session JSONL.
