# modes

Hardcoded mode system for Pi with tool policy and model switching.

## Modes

- `default`: native baseline (`read`, `bash`, `edit`, `write`) + all extension tools.
- `research`: read/research focused tooling; `write`/`edit` blocked; `bash` confirm each call; extension tools confirmation-gated by default, with side-effecting tools blocked.

## Controls

- `/mode`
- `/mode <default|research>`
- `Ctrl+U` cycle
- `--agent-mode <default|research>`

## Notes

- No config file and no `enabled` toggle by design.
- Uses `tool_call` hook for enforcement and `setActiveTools` for activation from policy.
- Persists mode per branch via custom `mode-state` entries.
- Injects mode guidance via `before_agent_start`.
- Sends `mode-switch` UI messages and filters them from LLM context.
