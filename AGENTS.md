# pi-harness

My personal harness around [Pi](https://github.com/badlogic/pi-mono/) for coding-agent work.

Internal workspace packages use the `@harness` scope and are private to this repository.

## Structure

- `commands/` - Slash commands (`/spawn`, `/qq`, `/projects:init`, etc.)
- `hooks/` - Event hooks (session protection, autocomplete, chrome, etc.)
- `tools/` - Agent tools (`bash`, `grep`, `find`, `read_url`, `oracle`, etc.)
- `extensions/` - Monolithic extensions still using their own `package.json` (`breadcrumbs`, `providers`)
- `packages/` - Shared internal workspace packages. Each `@harness/*` package lives in its own subdirectory here (e.g. `packages/agent-kit/` → `@harness/agent-kit`). Do not search for these with librarian — read them directly from `./packages/<name>/`.
- `tests/` - Test setup and docs. Shared test utilities live in `packages/test-utils`.

## Entry point convention

Every extension entry point is `export default function(pi: ExtensionAPI)`, calling `pi.registerCommand(...)`, `pi.registerTool(...)`, or `pi.on(...)` directly. No wrapper functions.

Pi discovers extensions from the root `package.json` `pi.extensions` array. Directories in that list are scanned for `index.ts` entry points.

## File layout convention

Within an extension directory:

- `index.ts` - Registration code. All `pi.*` and `ctx.*` calls live here.
- `types.ts` - Type definitions and TypeBox schemas
- `render.ts` / `renderers.ts` - Tool/message render functions
- `helpers.ts` / `fetch.ts` / `sanitize.ts` / `blocked-paths.ts` - Pure functions and utilities (names vary by domain)

No `pi.*` or `ctx.*` calls outside `index.ts`. Other files contain only pure functions, types, components, or utils.

### Subagent-based tools

Tools that spawn a subagent (oracle, reviewer, read-session, librarian) follow a different layout:

- `index.ts` - Registration code. Spawns the subagent via `ctx.newSession()`.
- `types.ts` - Subagent details schema and shared types
- `prompt.ts` - System prompt builder for the subagent
- `models/index.ts` - Model selection (picks provider/model for the subagent)
- `tools/` - Subagent tool definitions (only visible inside the subagent, not the parent)
- `lib/` - Supporting logic (GitHub clients, etc.)

## Commands

| Directory | Commands | Notes |
|---|---|---|
| `continue/` | `/continue` | Continue from a linked parent session |
| `introspection/` | `/introspection` | Inspect extension internals |
| `label/` | `/label <text>` | Label the current session entry |
| `projects/` | `/projects:init`, `/projects:settings` | Multi-step project setup wizard |
| `qq/` | `/qq <question>` | Quick question without interrupting main session |
| `session-copy-id/` | `/session:copy-id` | Copy session ID to clipboard |
| `session-copy-path/` | `/session:copy-path` | Copy session file path to clipboard |
| `spawn/` | `/spawn [note]` | Create a linked child session |
| `theme/` | `/theme` | Cycle color theme |

## Hooks

| Directory | Purpose | Key files |
|---|---|---|
| `chrome/` | Header, footer, terminal title, notifications, auto-naming | `hooks/`, `components/`, `lib/`, `native/` |
| `models-overrides/` | Override model props (context window, pricing) in models.json | `index.ts` |
| `event-compat/` | Backwards-compatible event aliases | `index.ts` |
| `protect-sessions-dir/` | Gate agent access to sessions directory | `gate.ts`, `session-gate-dialog.ts`, `bash-parser.ts` |
| `session-autocomplete/` | `@` autocomplete for session names | `db.ts`, `search.ts`, `provider.ts` |
| `session-title/` | Auto-name sessions | `index.ts` |

## Tools

| Directory | Tool name | Notes |
|---|---|---|
| `ask-user/` | `ask_user` | Passthrough |
| `bash/` | `bash` | Adds `cwd` param, spawn hooks, sanitization |
| `edit/` | `edit` | Passthrough |
| `find/` | `find` | Adds `glob`, blocked paths |
| `get-current-time/` | `get_current_time` | Passthrough |
| `grep/` | `grep` | Adds `literal`, `context`, blocked paths, custom render |
| `librarian/` | `librarian` | File search by description |
| `look-at/` | `look_at` | Image analysis |
| `oracle/` | `oracle` | GPT-5 advisor |
| `read/` | `read` | Passthrough |
| `read-session/` | `read_session` | Subagent session reader |
| `read-url/` | `read_url` | URL fetch with handler chain and preview |
| `reviewer/` | `reviewer` | Diff/code review |

## Monolithic extensions

These extensions still use their own `package.json` with `pi.extensions` and are discovered separately:

- `breadcrumbs/` - Session history tools (`find_sessions`, `list_sessions`, `read_session`)
- `providers/` - Rate-limit alerts, usage widgets, dashboards

## Development

Uses pnpm workspaces. Nix environment available via `flake.nix`.

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

Workspace packages (all in `./packages/` — read directly, do not search with librarian):

| Directory | Package | Description |
|---|---|---|
| `packages/agent-kit/` | `@harness/agent-kit` | Subagent framework used by harness tools and hooks |
| `packages/completion/` | `@harness/completion` | Completion logic |
| `packages/events/` | `@harness/events` | Shared event names and event payload types |
| `packages/test-utils/` | `@harness/test-utils` | Shared Vitest/Pi extension test harness utilities |
| `packages/utils/` | `@harness/utils` | Shared generic utilities |

## Custom header

The startup header (`hooks/chrome/components/header.ts`) shows a curated list of harness shortcuts and commands. When adding a new `registerShortcut` or `registerCommand`, ask the user whether it should be added to the header.

## Notes

- This repo is my private Pi harness infrastructure first. Not every package here is intended to be published as a standalone package.
- Keep repository-level docs focused on my Pi harness. Extension-specific details belong in the extension README files.
- Monolithic extensions (`breadcrumbs`, `providers`) may be migrated to the `commands/`/`hooks/`/`tools/` layout in the future.
