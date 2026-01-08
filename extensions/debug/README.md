# Debug Extension

Utilities for debugging Pi.

## Commands

### `/copy-session-path`

Copies the current session file path to clipboard and displays it as a notification.

Useful for inspecting session files, sharing paths, or debugging session-related issues.

If the session is ephemeral (not persisted), shows a warning instead.

## Requirements

Uses OSC 52 escape sequence for clipboard. Works with most modern terminals:
- iTerm2
- Kitty
- Alacritty
- WezTerm
- Ghostty
- Windows Terminal

Also works over SSH (copies to local clipboard).
