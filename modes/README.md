# Modes

Modes define high-level operating contexts for the harness.

## Location

All mode definitions live under:

- `modes/`

Modes are wired into the harness through the single root entrypoint:

- `index.ts`

## How mode switching works

Mode changes are exposed through the root tool:

- `mode.switch`

This means:

- mode definitions belong in `modes/`
- switching behavior is user-facing through `mode.switch`
- callers do not need to know internal registration details

## Expected mode workflow

When adding or editing a mode:

1. create or update the mode definition in `modes/`
2. export/register it from the modes index
3. ensure the root wiring includes the modes registry
4. verify `mode.switch` can resolve and activate it

## Design guidance

Prefer modes for:
- changing workflow posture
- changing default behavior or prompt framing
- organizing a small set of clearly named operating contexts

Do **not** use modes for:
- one-off commands
- specialized expert tasks that should be subagents
- generic helper functionality that belongs in tools

## Relationship to subagents

Modes and subagents solve different problems:

- **Modes** change the current operating context
- **Subagents** perform delegated specialized work through `subagent.<name>`

Use a mode when the whole session should behave differently.
Use a subagent when you want to invoke a specialist for a bounded task.

## Checklist for adding a mode

- [ ] Add the mode under `modes/`
- [ ] Export/register it in the modes index
- [ ] Confirm root entrypoint wiring still includes modes
- [ ] Confirm `mode.switch` can target it
- [ ] Document any behavior that contributors need to understand

## Keep it simple

A good mode is:
- easy to name
- easy to switch into
- obviously different from other modes
- not coupled to unrelated tool logic

If the change mostly affects one expert workflow instead of session-wide behavior, consider creating a subagent instead.
