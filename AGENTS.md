# pi-harness

My personal harness around [Pi](https://github.com/badlogic/pi-mono/) for coding-agent work.

This repo is a pnpm workspace. Internal shared dependencies live in `packages/` under the `@harness/*` scope and are private to this repository.

## Documentation maintenance

Keep this file current when adding, removing, moving, or materially changing commands, hooks, tools, extensions, packages, or shared architecture.

When adding new content or changing existing behavior, update the closest relevant documentation in the same change. Repository-level docs belong here. Feature-specific docs belong next to that feature only when they are actively maintained.

## Structure

- `commands/` - Slash commands and command-like UI flows.
- `hooks/` - Event hooks, lifecycle behavior, autocomplete providers, chrome, and background behavior.
- `tools/` - Agent tools exposed to Pi sessions.
- `packages/` - Shared internal workspace packages. Each package lives in `packages/<name>/` and is imported through its `@harness/*` workspace package name.
- `tests/` - Test setup and docs. Shared test utilities live in `packages/test-utils`.

## New feature placement

New functionality should be added as one of:

- `commands/<name>/` for slash commands.
- `hooks/<name>/` for event-driven behavior, UI chrome, autocomplete, lifecycle hooks, or background observers.
- `tools/<name>/` for agent-callable tools.
- `packages/<name>/` for shared internal code.

Avoid cross-imports between `commands/`, `hooks/`, and `tools/`. If code needs to be shared across those areas:

1. Vendor it locally if it is tiny and unlikely to grow.
2. Prefer adding it to an existing `packages/*` workspace package when it fits.
3. Create a new `packages/*` workspace package when it is a distinct shared concern.

## Entry point convention

Every extension entry point is `export default function(pi: ExtensionAPI)`, calling `pi.registerCommand(...)`, `pi.registerTool(...)`, or `pi.on(...)` directly. No wrapper functions.

Pi discovers extensions from the root `package.json` `pi.extensions` array. Directories in that list are scanned for `index.ts` entry points.

## File layout convention

Within a command, hook, or tool directory:

- `index.ts` - Registration code. All `pi.*` and `ctx.*` calls live here.
- `types.ts` - Type definitions and TypeBox schemas when needed.
- `render.ts` / `renderers.ts` - Tool/message render functions when needed.
- `helpers.ts` / `fetch.ts` / `sanitize.ts` / `blocked-paths.ts` - Pure functions and utilities. Names vary by domain.

No `pi.*` or `ctx.*` calls outside `index.ts`. Other files contain only pure functions, types, components, or utils.

### Subagent-based tools

Tools that spawn a subagent follow a different layout:

- `index.ts` - Registration code. Spawns the subagent via `ctx.newSession()`.
- `types.ts` - Subagent details schema and shared types.
- `prompt.ts` - System prompt builder for the subagent.
- `models/index.ts` - Model selection for the subagent.
- `tools/` - Subagent tool definitions, visible only inside the subagent.
- `lib/` - Supporting logic.

Current subagent-based tools include `artisan`, `librarian`, `oracle`, `read-session`, `reviewer`, and `scout`.

## Commands

| Directory | Commands | Notes |
|---|---|---|
| Directory | Commands | Notes |
|---|---|---|
| `continue/` | `/continue` | Continue from a linked parent session |
| `copy-session-id/` | `/copy:session-id` | Copy session ID to clipboard |
| `copy-session-path/` | `/copy:session-path` | Copy session file path to clipboard |
| `label/` | `/label <text>` | Label the current session entry |
| `qq/` | `/qq <question>`, `/qq:list` | Quick question without interrupting main session |
| `review/` | `/review`, `/review:split` | Local review workflow |
| `spawn/` | `/spawn [note]` | Create a linked child session |
| `theme/` | `/theme` | Cycle color theme |
| `usage/` | `/usage` | Interactive provider usage dashboard |

## Hooks

| Directory | Purpose | Key files |
|---|---|---|
| `chrome/` | Header, footer, terminal title, notifications, auto-naming; footer shows cost, context, latest TPS telemetry, cache hit rate, and resume cache freshness | `hooks/`, `components/`, `lib/`, `native/` |
| `default-settings/` | Default settings setup | `index.ts` |
| `event-compat/` | Backwards-compatible event aliases | `index.ts` |
| `compact/` | Sequential compaction via `session_before_compact` | `index.ts`, `compaction.ts`, `prompts.ts`, `utils.ts` |
| `fast-mode/` | Session-local fast-mode controls for Anthropic and Codex | `index.ts`, `anthropic.ts`, `codex.ts`, `helpers.ts` |
| `models-overrides/` | Override model props in models.json | `index.ts` |
| `project-trust/` | Auto-trust projects matching configured path prefixes; falls through to core for everything else | `index.ts`, `config.ts`, `types.ts` |
| `protect-sessions-dir/` | Gate agent access to sessions directory | `gate.ts`, `session-gate-dialog.ts`, `bash-parser.ts` |
| `session-autocomplete/` | `@@` autocomplete for session references | `index.ts`, `provider.ts` |
| `session-name/` | Auto-name sessions | `index.ts` |
| `skill-autocomplete/` | `?` skill directory autocomplete | `index.ts` |
| `tmux-autocomplete/` | `@tmux:` tmux session/window autocomplete | `index.ts`, `provider.ts`, `tmux.ts`, `types.ts` |
| `tps/` | Per-turn tokens-per-second telemetry emitted as `ad:tps:telemetry` for footer display and other consumers | `index.ts`, `utils.ts`, `types.ts` |
| `zoxide-autocomplete/` | `@z:` project path autocomplete | `index.ts` |

## Tools

| Directory | Tool name | Notes |
|---|---|---|
| `artisan/` | `artisan`, `resume_artisan` | Design-focused subagent |
| `ask-user/` | `ask_user` | Passthrough |
| `bash/` | `bash` | Adds `cwd` param, spawn hooks, sanitization |
| `edit/` | `edit` | Passthrough |
| `find/` | `find` | Adds `glob`, blocked paths |
| `find-sessions/` | `find_sessions` | Session keyword search via `@harness/session-store` |
| `get-current-time/` | `get_current_time` | Passthrough |
| `grep/` | `grep` | Adds `literal`, `context`, blocked paths, custom render |
| `librarian/` | `librarian`, `resume_librarian` | Codebase-understanding subagent |
| `list-sessions/` | `list_sessions` | Session directory listing via `@harness/session-store` |
| `look-at/` | `look_at` | Image analysis; BMP files are converted to PNG before vision analysis |
| `oracle/` | `oracle`, `resume_oracle` | Senior advisor subagent |
| `read/` | `read` | Passthrough; BMP images are converted to PNG before upstream handling |
| `read-session/` | `read_session` | Subagent session reader |
| `read-url/` | `read_url` | URL fetch with handler chain and preview |
| `reviewer/` | `reviewer`, `resume_reviewer` | Formal code-review subagent |
| `scout/` | `scout`, `resume_scout` | Local codebase-understanding subagent |

## Development

Uses pnpm workspaces. Nix environment available via `flake.nix`.

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

Workspace packages:

| Directory | Package | Description |
|---|---|---|
| `packages/agent-kit/` | `@harness/agent-kit` | Subagent framework used by harness tools and hooks |
| `packages/completion/` | `@harness/completion` | Completion logic |
| `packages/events/` | `@harness/events` | Shared event names and event payload types |
| `packages/image-formats/` | `@harness/image-formats` | Image MIME detection and format conversion |
| `packages/models/` | `@harness/models` | Model groups, model usability, quota-aware broker, usage cache, history, and projections (used by the usage dashboard; subagents no longer use the broker) |
| `packages/provider-usage/` | `@harness/provider-usage` | Provider quota clients and normalized usage abstractions |
| `packages/session-store/` | `@harness/session-store` | Session directory access, Sesame search, and listing |
| `packages/session-tools/` | `@harness/session-tools` | Pi-agnostic session entry indexing, branch/tree traversal, and bounded read-session helpers |
| `packages/test-utils/` | `@harness/test-utils` | Shared Vitest/Pi extension test harness utilities |
| `packages/ui/` | `@harness/ui` | Shared TUI components/helpers |
| `packages/utils/` | `@harness/utils` | Shared generic utilities |

## Custom header

The startup header (`hooks/chrome/components/header.ts`) shows a curated list of harness commands, shortcuts, and completion providers. Extensions register these entries by listening to `AD_HEADER_COLLECT_EVENT` and emitting the matching `AD_HEADER_REGISTER_*` event from `@harness/events`. When adding a new `registerShortcut`, `registerCommand`, or autocomplete provider, ask whether it should be added to the header.

## Notes

- This repo is private Pi harness infrastructure first. Not every package here is intended to be published as a standalone package.
- Keep repository-level docs focused on this Pi harness. Feature-specific details belong next to the feature only when those docs are actively maintained.
