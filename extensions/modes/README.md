# modes

Two-mode system for Pi with prompt families, tool policy, and per-branch restore.

## Modes

- `balanced` (default)
  - All tools enabled, no gating
  - No model override (uses Pi's default)
  - Label color: `#777777`

- `research`
  - Allowed: `read`, `ls`, `find`, `grep`, `get_current_time`, `read_url`, `find_sessions`, `list_sessions`, `read_session`, `ask_user`, `synthetic_web_search`, `linkup_web_search`, `linkup_web_answer`, `linkup_web_fetch`, `scout`, `lookout`, `oracle`, `reviewer`, `switch_mode`
  - Gated: `bash` (requires confirmation per call)
  - Provider/model: `anthropic / claude-opus-4-6`
  - Thinking: `high`
  - Label color: `#5f8faf`

## Prompt families

Model-family-aware system prompts that tune behavioral patterns per model family. Resolved from the active model's provider and ID.

- `claude` - Light touch for Claude models (good instruction following)
- `openai-codex` - Explicit structure and guardrails for GPT-5.x
- `kimi` - Aggressive concision steering for Kimi K2.5
- `glm` - Structured guidance for GLM-5/GLM-4.7

Mode system prompt replaces the family prompt when a mode is active. Family prompts serve as fallback when no mode system prompt exists.

Resolution order:
1. Provider `openai-codex` or `openai` -> `openai-codex`
2. Provider `anthropic` -> `claude`
3. Model ID containing `kimi` -> `kimi`
4. Model ID containing `glm` -> `glm`
5. Fallback -> `claude`

Requires `<!-- PROMPT_FAMILY -->` marker in `~/.pi/agent/APPEND_SYSTEM.md`. The `system-md-check` hook prompts to create it on first run if missing.

## Controls

- `/mode` opens selector
- `/mode <balanced|research>` switches directly
- `switch_mode` tool switches between modes with explicit in-tool confirmation
- `Ctrl+U` cycles modes
- `--agent-mode <balanced|research>` sets startup mode

## Behavior

- Tool access is list-based: `allowedTools` are enabled freely, `gatedTools` require confirmation per call.
- Empty arrays mean all tools are available (balanced mode).
- `pi.setActiveTools()` activates tools from the lists.
- `tool_call` hook enforces gating for `gatedTools` at runtime.
- Mode switch sets model, thinking level, active tools, and system prompt.
- Mode state persisted with `appendEntry("mode-state", ...)`.
- Restores mode per branch using `sessionManager.getBranch()`.
- User-initiated switches defer persistence to next turn boundary.
- Agent-initiated switches (switch_mode tool) persist immediately.
- Sends UI-visible custom `mode-switch` messages.
- Filters `mode-switch` messages out of LLM context via `context` hook.

## Event compatibility pattern

For cross-extension notification and sound interoperability, emit this event shape:

```ts
pi.events.emit("ad:notify:dangerous", {
  command: string,
  description: string,
  pattern: string,
  toolName?: string,
  toolCallId?: string,
});
```

`defaults` listens for this event, plays the attention sound, and uses `toolName`/`toolCallId` (when present) to keep terminal-title attention aligned with the exact triggering tool call.
