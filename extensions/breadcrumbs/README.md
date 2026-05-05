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

## Notes

- Session protection (`protect-sessions-dir`) and session commands (`/spawn`, `/continue`, `/label`, `/session:copy-id`, `/session:copy-path`) have moved to `hooks/` and `commands/` at the repository root.
- `read_session` has moved to `tools/read-session/`.
