# Pi Extensions

This repository hosts custom extensions for [Pi](https://github.com/mariozechner/pi-coding-agent), a coding agent.

## Structure

- `extensions/` - Custom Pi extensions
- `packages/` - Shared packages (e.g., tsconfig)

## Development

Uses pnpm workspaces. Nix environment available via `flake.nix`.

```sh
pnpm install
pnpm typecheck
pnpm lint
```
