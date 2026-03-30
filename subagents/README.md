# Specialized Subagents Extension

Framework for running specialized subagents behind first-class Pi tools.

This extension registers six tools:

- `scout`
- `lookout`
- `oracle`
- `reviewer`
- `jester`
- `worker`

Each tool delegates to a subagent with its own system prompt, model selection, optional skills, logging, and UI rendering.

## What it does

- Registers all subagent tools at extension load.
- Resets per-session model selections on `session_start`.
- Applies enable/disable toggles before each agent turn.
- Logs each subagent run under `~/.pi/agent/subagents/...`.
- Supports optional debug logs via `debug.jsonl`.
- Supports passing Pi skills into subagents by exact skill name.

## Registered subagents

### Scout

Deep web and GitHub research subagent.

Inputs:

- `url?`
- `query?`
- `repo?`
- `prompt`
- `skills?`

At least one of `url`, `query`, or `repo` is required.

Scout uses custom tools, not Pi built-ins. Current internal toolset:

- `webSearch`
- `webFetch`
- `githubContent`
- `githubSearch`
- `githubCommits`
- `githubIssue`
- `githubIssues`
- `githubPrDiff`
- `githubPrReviews`
- `githubCompare`
- `listUserRepos`
- `downloadGist`
- `uploadGist`

Default routed web config:

- Search order: `synthetic -> exa -> linkup`
- Fetch order: `markdownDotNew -> exa -> linkup`

Required env depends on which providers you actually use. The extension only checks `SCOUT_GITHUB_TOKEN` at load time. In the default config, Scout also expects `SYNTHETIC_API_KEY` for search.

Relevant env vars:

- `SCOUT_GITHUB_TOKEN`
- `SYNTHETIC_API_KEY`
- `EXA_API_KEY`
- `LINKUP_API_KEY`

### Lookout

Local codebase search subagent.

Inputs:

- `query`
- `cwd?`
- `skills?`

Lookout uses Pi read-only tools created by `createReadOnlyTools(workingDir)`:

- `grep`
- `find`
- `read`
- `ls`

It does not use `osgrep`.

If the model returns an answer without using search tools, the response is discarded to avoid hallucinated file paths.

### Oracle

Advisory subagent for planning, debugging, architecture review, and deep reasoning.

Inputs:

- `task`
- `context?`
- `files?`
- `skills?`

Oracle is advisory-only. It does not use tools. If `files` are provided, their contents are read by the tool wrapper and embedded into the subagent prompt.

### Reviewer

Diff review subagent.

Inputs:

- `diff`
- `focus?`
- `context?`
- `skills?`

Reviewer uses:

- Pi read-only tools for repository inspection
- Pi `bash` for git/diff commands
- additional reviewer-specific custom tools

It is intended for review of staged changes, commits, or scoped diffs.

### Jester

Creative generation subagent.

Input:

- `question`

Jester uses no tools. It is for random, creative, or unexpected output only.

### Worker

Sandboxed implementation subagent for known files.

Inputs:

- `task`
- `instructions`
- `files`
- `context?`
- `skills?`

Worker does not explore the repo. It gets a restricted toolset:

- scoped `read`
- scoped `edit`
- scoped `write`
- guarded `bash`

The worker bash wrapper blocks policy-violating commands. Worker is intended to run verification before finishing and must not bypass checks with flags like `--no-verify`.

## Models

Each subagent has its own candidate model list in `extensions/subagents/config.ts`.

Configured subagents:

- `scout`
- `lookout`
- `oracle`
- `reviewer`
- `jester`
- `worker`

The extension resolves model candidates per subagent and resets per-session selections on session start.

## Skills

`scout`, `lookout`, `oracle`, `reviewer`, and `worker` accept `skills`.

Skill resolution is exact-name only and uses Pi skill discovery for the current cwd. Missing skill names are reported back to the subagent call.

`jester` does not accept skills.

## Logging

Each run gets its own log directory:

`~/.pi/agent/subagents/<sanitized-cwd>/<subagent-name>/<run-id>/`

Files:

- `stream.log` - human-readable run log
- `debug.jsonl` - raw event log when debug is enabled

Run IDs look like:

`<subagent>-<YYYYMMDD-HHMMSS>-<random6>`

## Settings

This extension registers the `/subagents:settings` command.

Current settings cover:

- global debug logging
- per-subagent enabled/disabled state
- Scout web routing
  - search order
  - fetch order
  - provider enable flags
  - Exa search mode
  - Linkup search depth
  - Linkup `renderJsDefault`

All tools are registered up front. Before each agent turn, disabled subagents are removed from the active tool list.

## Files worth reading

- `extensions/subagents/index.ts` - extension registration and activation logic
- `extensions/subagents/config.ts` - model candidates and Scout web config
- `extensions/subagents/commands/settings-command.ts` - `/subagents:settings`
- `extensions/subagents/lib/executor.ts` - shared subagent execution path
- `extensions/subagents/lib/logging/` - run log layout and writers
- `extensions/subagents/lib/skills.ts` - skill resolution
- `extensions/subagents/subagents/*` - per-subagent implementation

## Adding a new subagent

Use the `create-specialized-subagent` skill.

Reference structure from an existing subagent such as:

- `extensions/subagents/subagents/scout/`
- `extensions/subagents/subagents/worker/`

Typical pieces:

- `index.ts`
- `system-prompt.ts`
- `types.ts`
- `tools/` when the subagent needs custom tools
