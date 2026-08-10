## Disable fullscreen copy-on-select

Disables the alternate-screen mouse-selection clipboard write.

Upstream PR https://github.com/earendil-works/pi/pull/7757 adds a setting for
fullscreen copy-on-select and wires the message-copy action to copy an active
selection. This local patch intentionally does less: selection can still be
highlighted, but releasing the mouse does not write OSC 52 clipboard data, and
no explicit keybinding fallback is added.

