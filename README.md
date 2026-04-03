# pi-harness

Personal Pi harness built around a **single root extension entrypoint**.

## Install

```bash
pi install git:github.com/aliou/pi-harness
```

This package exposes one extension bundle from `pi.extensions`:

- `./dist/index.js`

## Architecture

Source of truth layout:

- `index.ts` — root orchestrator entrypoint
- `tools/` — root tools
- `modes/` — mode definitions + lifecycle wiring
- `subagents/` — subagent definitions + registration
- `extensions/` — feature modules (internal organization)
- `config/` — shared config

The harness is **not** a multi-top-level-extension package anymore.

## Tool surface

Root tools include file/system/session utilities and control tools.

Notable names:

- `mode.switch`
- `subagent.scout`
- `subagent.lookout`
- `subagent.oracle`
- `subagent.reviewer`
- `subagent.jester`
- `subagent.worker`

Subagents are always exposed as `subagent.<name>`.

## Build

- bundle output: `dist/index.js`
- build tool: `tsup`
- runtime target: Node 22

`postinstall` runs build so installed package has fresh dist output.

## Notes

`extensions/` is still used for feature grouping, but those modules plug into the root entrypoint flow. Do not treat them as separate package entrypoints.

For contributor constraints and conventions, see `AGENTS.md`.
