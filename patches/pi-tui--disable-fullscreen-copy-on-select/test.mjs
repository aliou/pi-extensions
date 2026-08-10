// Guards the patch that disables fullscreen copy-on-select.
//
// A completed mouse selection must keep selection state/rendering behavior but
// must not emit an OSC 52 clipboard write. This fails on unpatched pi-tui,
// where mouse release copies the selected text to the clipboard.

import { TuiAltScreen } from "@earendil-works/pi-tui/dist/tui-alt-screen.js";

let failed = 0;
const assert = (name, cond) => {
  console.log(`${cond ? "ok" : "not ok"} - ${name}`);
  if (!cond) failed++;
};

const writes = [];
const terminal = {
  columns: 10,
  rows: 5,
  write: (data) => writes.push(data),
};

const tui = new TuiAltScreen(terminal, false, undefined, { mouse: false });
tui.previousScreen = ["abcdef"];
tui.selectionPressActive = true;
tui.selectionAnchor = { row: 0, col: 1 };
tui.selectionFocus = { row: 0, col: 1 };

tui.handleSelectionMouseEvent({ button: 0, release: true, x: 4, y: 0 });

assert("mouse-release selection does not write OSC 52 clipboard data", writes.every((data) => !data.includes("\x1b]52;")));
assert("completed selection remains active for highlighting", tui.getSelectionBounds()?.start.col === 1 && tui.getSelectionBounds()?.end.col === 4);

if (failed > 0) process.exit(1);
