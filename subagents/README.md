# Subagents

Specialized agents registered through the root harness and invoked via namespaced tools.

## Registration model

Subagents are part of the single-root architecture:

- root entrypoint: `index.ts`
- subagent registry: `subagents/index.ts`
- shared subagent config: `subagents/config.ts`

They are exposed as root tools with the pattern:

- `subagent.<name>`

Current set:

- `subagent.scout`
- `subagent.lookout`
- `subagent.oracle`
- `subagent.reviewer`
- `subagent.jester`
- `subagent.worker`

## Intent by subagent

### `subagent.scout`
Deep web + GitHub research and synthesis.

### `subagent.lookout`
Local codebase search by behavior/flow/concept.

### `subagent.oracle`
Advisory reasoning for planning/debugging/architecture.

### `subagent.reviewer`
Diff-focused code review feedback.

### `subagent.jester`
Creative/random generation. No factual guarantees.

### `subagent.worker`
Focused implementation on known files with verification expectations.

## Models and settings

Per-subagent model candidate selection and web-routing settings live in:

- `subagents/config.ts`

User-facing subagent settings command is:

- `/subagents:settings`

## Logging

Subagent runs are logged under:

- `~/.pi/agent/subagents/...`

Exact path shaping and logger implementation live in:

- `subagents/lib/logging/`

## Adding a new subagent

1. Create `subagents/<name>/...`
2. Register in `subagents/index.ts`
3. Update `subagents/config.ts` when model/settings plumbing is needed
4. Expose as `subagent.<name>`
5. Reuse root tools where appropriate instead of cloning behavior

See `.pi/skills/create-specialized-subagent/SKILL.md` for scaffold guidance.

## Important conventions

- Keep namespaced tool naming (`subagent.<name>`)
- Keep registration centralized
- Keep docs aligned with root-single-entrypoint architecture
- Avoid reviving old `extensions/subagents/...` path assumptions
