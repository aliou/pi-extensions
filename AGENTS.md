# Contributor Notes

This repo uses a **single-root harness architecture**. When making changes, follow the current structure rather than older multi-entrypoint patterns.

## Source of truth

The current top-level layout is:

- `index.ts` — single extension entrypoint
- `tools/` — root tools
- `modes/` — mode definitions
- `subagents/` — subagent definitions and registration
- `extensions/` — remaining feature modules
- `config/` — shared config
- `packages/` — internal packages

Do **not** introduce new top-level extension entrypoints unless there is a strong, explicit reason.

## Rules of thumb

### 1) Keep root wiring centralized
If you add a user-facing capability, make sure it is wired through the root entrypoint flow.

Prefer:
- adding tool registration in `tools/`
- adding mode registration in `modes/`
- adding subagent registration in `subagents/`

Avoid:
- hidden side-effect registration
- scattered entrypoint logic
- duplicate registration paths

### 2) Use namespaced subagent tools
Subagents should be exposed as:

- `subagent.scout`
- `subagent.lookout`
- `subagent.oracle`
- `subagent.reviewer`
- `subagent.jester`
- `subagent.worker`

Follow the same pattern for new subagents:

- `subagent.<name>`

Do not expose subagents as generic root tool names.

### 3) Use `mode.switch` for mode changes
Modes live in `modes/`, but switching is surfaced via the root tool:

- `mode.switch`

If you add a mode:
- define it under `modes/`
- register it in the modes index
- make sure switch resolution stays accurate

### 4) Reuse root tools through catalog plumbing
If a subagent needs common capabilities, prefer sharing existing **root non-subagent tools** through tool catalog plumbing instead of reimplementing them.

Examples of reusable root tools:
- `read`
- `edit`
- `find`
- `bash`
- `read_url`
- `read_session`
- `ask_user`

This keeps behavior consistent and reduces drift.

### 5) Keep `extensions/` for feature modules
`extensions/` is still the right place for grouped feature logic such as:
- breadcrumbs
- defaults
- editor
- palette
- planning
- providers

But these are no longer separate top-level extension entrypoints. They should plug into the root entrypoint architecture.

## When editing specific areas

### Tools
- put implementations in `tools/`
- keep names stable and explicit
- prefer small, composable tools
- avoid creating subagent-specific copies of generic utilities

### Subagents
- add files under `subagents/<name>/`
- register in `subagents/index.ts`
- update any shared config in `subagents/config.ts` if needed
- expose via `subagent.<name>`

### Modes
- add definitions under `modes/`
- document intended usage
- keep mode behavior understandable from the mode metadata/prompt

### Package/build
- bundle output is `dist/index.js`
- package manifest points `pi.extensions` at that file
- build uses `tsup`
- runtime target is Node 22

## Preferred change style

Prefer:
- minimal diffs
- explicit exports
- one registration path
- small, local changes

Avoid:
- broad restructuring unless required
- reviving legacy doc structure
- adding duplicate abstractions around tools/modes/subagents

## Documentation expectations

If you change architecture or workflows, update docs that describe the current structure:

- `README.md`
- `modes/README.md`
- `subagents/README.md`
- relevant skill docs under `.pi/skills/`

Docs should describe the **current** refactored harness, not historical layouts.

## Sanity checklist before finishing

- [ ] New code is reachable from `index.ts` through normal registration
- [ ] Tool names follow current conventions
- [ ] New subagents use `subagent.<name>`
- [ ] Mode changes go through `mode.switch`
- [ ] Shared tool reuse is done via tool catalog plumbing where appropriate
- [ ] Docs still match the filesystem and bundle entrypoint
