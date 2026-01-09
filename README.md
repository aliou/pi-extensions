# Pi Extensions

Custom extensions for [Pi](https://github.com/mariozechner/pi-coding-agent), a coding agent.

## Extensions

| Extension | Description |
|-----------|-------------|
| [debug](extensions/debug/README.md) | Debugging utilities (session path clipboard) |
| [meta](extensions/meta/README.md) | Pi introspection tools (version, docs, changelog) |
| [pi-ui](extensions/pi-ui/README.md) | Custom header and footer |
| [processes](extensions/processes/README.md) | Background process management |

## Development

Uses pnpm workspaces. Nix environment available via `flake.nix`.

```sh
pnpm install
pnpm typecheck
pnpm lint
```
