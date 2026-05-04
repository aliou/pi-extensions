# pi-harness

My personal harness around [Pi](https://github.com/badlogic/pi-mono/) for coding-agent work.

Internal workspace packages use the `@harness` scope and are private to this repository.

## Structure

- `extensions/` - Private Pi extensions bundled in this repository
- `packages/` - Shared internal workspace packages (`@harness/*`)
- `tests/` - Test setup and docs. Shared test utilities live in `packages/test-utils`.

## Extensions

- `breadcrumbs` - Session history tools. Search past sessions, extract information, and hand off context to new sessions.
- `qq` - `/qq` quick-question command with custom message rendering and context filtering.
- `defaults` - Personal sensible defaults and quality-of-life improvements.
- `palette` - Command palette with keyboard-driven UI for running commands and shortcuts.
- `planning` - Turn conversations into implementation plans and manage saved plans.
- `providers` - Register custom providers and show unified rate-limit and usage dashboards.
- `subagents` - Framework for spawning specialized subagents with custom tools, consistent UI rendering, and logging.

## Development

Uses pnpm workspaces. Nix environment available via `flake.nix`.

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

Workspace packages:

- `@harness/agent-kit` - Subagent framework used by harness tools and hooks.
- `@harness/events` - Shared event names and event payload types.
- `@harness/utils` - Shared generic utilities.
- `@harness/test-utils` - Shared Vitest/Pi extension test harness utilities.

## Custom header

The startup header (`extensions/defaults/components/header.ts`) shows a curated list of harness shortcuts and commands. When adding a new `registerShortcut` or `registerCommand`, ask the user whether it should be added to the header.

## Notes

- This repo is my private Pi harness infrastructure first. Not every package here is intended to be published as a standalone package.
- Keep repository-level docs focused on my Pi harness. Extension-specific details belong in the extension README files.
