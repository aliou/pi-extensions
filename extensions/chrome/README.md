# chrome

Chrome extension for Pi — owns the visual chrome around the coding agent.

## Features

### Header

Custom header showing harness commands, replacing the built-in keybinding hints.

### Footer

Two-line footer layout:
- Line 1: Path + git branch/status + stats (cost, context usage)
- Line 2: Session name + model info with thinking level

Progressive degradation for narrow terminals: drops branch, truncates path, switches to minimal stats.

### Terminal title

Updates the terminal title with a project breadcrumb and current activity:
- Session start: `pi: <project breadcrumb>`
- Agent running: `pi: <project breadcrumb> (thinking...)`
- Tool call: `pi: <project breadcrumb> (<tool name>)`
- Attention marker: appends ` [!]` for attention/dangerous events

### Notifications

Sends OS-level terminal notifications using OSC escape sequences with optional macOS sounds:
- Plays attention sound when `ask_user` tool is invoked
- Sends summary notification when agent finishes
- Listens for `ad:notify:dangerous` and `ad:notify:attention` events

### Auto session naming

Automatically names sessions after the first completed agent loop, using `google/gemini-2.5-flash-lite` to generate a concise title.
