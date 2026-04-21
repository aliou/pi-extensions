# modes

Hardcoded mode system with prompt families, tool policy, and model switching.

## Modes

- `balanced` (default): all tools, no model override, no gating.
- `research`: read-only + research tools, `bash` gated, Claude Opus, high thinking.

## Prompt families

- `claude`, `openai-codex`, `kimi`, `glm` -- resolved from model provider/ID.
- Mode system prompt replaces the family prompt (not append).
- Requires `<!-- PROMPT_FAMILY -->` marker in `~/.pi/agent/APPEND_SYSTEM.md`.

## Controls

- `/mode`, `/mode <name>`, `Ctrl+U` cycle, `--agent-mode <name>`
- `switch_mode` tool with explicit in-tool confirmation

## Tool policy

Each mode defines `allowedTools` (enabled freely) and `gatedTools` (enabled but require confirmation per call). When both arrays are empty, all tools are available (balanced mode).

The `tool_call` hook enforces gating at runtime. `gatedTools` and `allowedTools` are assumed disjoint.

## Branch persistence

Mode is persisted to the session branch via `mode-state` entries. On restore, the last `mode-state` entry determines the mode.

User-initiated switches (Ctrl+U, /mode) defer persistence to the next turn boundary (`before_agent_start`). Agent-initiated switches (switch_mode tool) persist immediately. This avoids accumulating entries during rapid mode cycling.

## Notes

- No config file and no `enabled` toggle by design.
- Balanced mode has no model/thinking override -- Pi's default selection applies.
- Research mode sets `anthropic / claude-opus-4-6` with high thinking on switch.
- Border colors are raw hex (editor extension converts to ANSI RGB).
