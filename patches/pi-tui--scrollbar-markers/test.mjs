// Guards the pi-tui scrollbar marker patch.
//
// Sweeps every scroll position of a transcript whose content lines carry a
// background reaching the scrollbar column (what a user message looks like),
// and resolves the terminal SGR state at each marker glyph. Fails on unpatched
// code, where `scrollbarMarkers` is ignored and no glyph is ever painted.

import { ScrollView, Text, VStack } from "@earendil-works/pi-tui";
import { getScrollViewBox, getScrollbarGeometry, renderLayoutFrame } from "@earendil-works/pi-tui/dist/layout.js";

let failed = 0;
const assert = (name, cond) => {
  console.log(`${cond ? "ok" : "not ok"} - ${name}`);
  if (!cond) failed++;
};

const MESSAGE_BG = "\x1b[48;2;30;30;40m";
const THUMB_BG = "2;64;64;64";
const LABEL_FG = "2;255;255;0";
const USER_FG = "2;0;128;255";

const lines = Array.from({ length: 100 }, (_, i) => `${MESSAGE_BG}${`line ${i}`.padEnd(60)}\x1b[49m`);
const scrollView = new ScrollView(new Text(lines.join("\n"), 0, 0), {
  follow: "end",
  primary: true,
  scrollbar: "always",
  scrollbarStyle: (text) => `\x1b[48;${THUMB_BG}m${text}\x1b[49m`,
  scrollbarMarkerStyles: {
    label: () => `\x1b[49m\x1b[38;${LABEL_FG}m\u2584\x1b[39m`,
    user: () => `\x1b[49m\x1b[38;${USER_FG}m\u2584\x1b[39m`,
  },
});
scrollView.scrollbarMarkers = () => [
  { position: 0.3, kind: "label" },
  { position: 0.7, kind: "user" },
];

const root = new VStack([
  { component: scrollView, basis: 0, grow: 1, shrink: 1, minSize: 1 },
  { component: new Text("dock", 0, 0), basis: "auto", grow: 0 },
]);

// Two frames: the first establishes layout, the second is measured.
renderLayoutFrame(root, 40, 24, () => {});
const geometry = getScrollbarGeometry(getScrollViewBox(renderLayoutFrame(root, 40, 24, () => {}), scrollView));
const rowOf = (fraction) => geometry.trackTop + Math.round(fraction * (geometry.trackHeight - 1));
const markers = [
  { kind: "label", row: rowOf(0.3), fg: LABEL_FG },
  { kind: "user", row: rowOf(0.7), fg: USER_FG },
];

/** Resolve the foreground/background in effect where the marker glyph is drawn. */
function stateAtGlyph(line) {
  const glyph = line.indexOf("\u2584");
  if (glyph < 0) return null;
  let fg = null;
  let bg = null;
  const sgr = /\x1b\[([0-9;]*)m/g;
  let match;
  while ((match = sgr.exec(line)) && match.index < glyph) {
    const codes = match[1] === "" ? ["0"] : match[1].split(";");
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code === "0") {
        fg = null;
        bg = null;
      } else if (code === "38" || code === "48") {
        const count = codes[i + 1] === "2" ? 4 : 2;
        const value = codes.slice(i + 1, i + 1 + count).join(";");
        if (code === "38") fg = value;
        else bg = value;
        i += count;
      } else if (code === "39") fg = null;
      else if (code === "49") bg = null;
    }
  }
  return { fg, bg };
}

let painted = 0;
let onThumb = 0;
let offThumb = 0;
let colorLost = 0;
let thumbHalfWrong = 0;
let backgroundLeaked = 0;

for (let scrollTop = 0; scrollTop <= geometry.maxScrollTop; scrollTop++) {
  scrollView.scrollTo(scrollTop);
  const frame = renderLayoutFrame(root, 40, 24, () => {});
  const live = getScrollbarGeometry(getScrollViewBox(frame, scrollView));
  for (const marker of markers) {
    const state = stateAtGlyph(frame.lines[marker.row] ?? "");
    if (!state) continue;
    painted++;
    if (state.fg !== marker.fg) colorLost++;
    if (marker.row >= live.thumbTop && marker.row < live.thumbTop + live.thumbHeight) {
      onThumb++;
      if (state.bg !== THUMB_BG) thumbHalfWrong++;
    } else {
      offThumb++;
      if (state.bg !== null) backgroundLeaked++;
    }
  }
}

const expected = (geometry.maxScrollTop + 1) * markers.length;
assert(`every marker is painted at every scroll position (${painted}/${expected})`, painted === expected);
assert("both on-thumb and off-thumb placements are exercised", onThumb > 0 && offThumb > 0);
assert(`markers keep their own color (${colorLost} lost)`, colorLost === 0);
assert(`markers over the thumb take the thumb background (${thumbHalfWrong} wrong)`, thumbHalfWrong === 0);
assert(`message background never leaks into a marker (${backgroundLeaked} leaked)`, backgroundLeaked === 0);

// A background reset only counts in command position. These styles must behave
// like the separated `\x1b[49m\x1b[38;...m` form above: over the thumb the reset
// is stripped so the thumb background shows, while a 49 that is really a color
// index or color component is left intact.
for (const [name, marker, wantFg] of [
  ["49 combined with the foreground", `\x1b[49;38;${LABEL_FG}m\u2584\x1b[39m`, LABEL_FG],
  ["49 as a 256-color index", `\x1b[49m\x1b[38;5;49m\u2584\x1b[39m`, "5;49"],
  ["49 as a color component", `\x1b[49m\x1b[38;2;0;49;0m\u2584\x1b[39m`, "2;0;49;0"],
]) {
  const view = new ScrollView(new Text(lines.join("\n"), 0, 0), {
    follow: "end",
    primary: true,
    scrollbar: "always",
    scrollbarStyle: (text) => `\x1b[48;${THUMB_BG}m${text}\x1b[49m`,
    scrollbarMarkerStyles: { label: () => marker },
  });
  const viewRoot = new VStack([
    { component: view, basis: 0, grow: 1, shrink: 1, minSize: 1 },
    { component: new Text("dock", 0, 0), basis: "auto", grow: 0 },
  ]);
  renderLayoutFrame(viewRoot, 40, 24, () => {});
  const viewGeometry = getScrollbarGeometry(getScrollViewBox(renderLayoutFrame(viewRoot, 40, 24, () => {}), view));
  // Place the marker in the middle of the thumb at the current scroll position.
  const thumbRow = viewGeometry.thumbTop + Math.floor(viewGeometry.thumbHeight / 2);
  view.scrollbarMarkers = () => [{ position: (thumbRow - viewGeometry.trackTop) / (viewGeometry.trackHeight - 1), kind: "label" }];
  const frame = renderLayoutFrame(viewRoot, 40, 24, () => {});
  const live = getScrollbarGeometry(getScrollViewBox(frame, view));
  const state = stateAtGlyph(frame.lines[thumbRow] ?? "");
  const covered = thumbRow >= live.thumbTop && thumbRow < live.thumbTop + live.thumbHeight;
  assert(`${name}: marker painted over the thumb`, covered && state !== null);
  assert(`${name}: keeps its foreground`, state?.fg === wantFg);
  assert(`${name}: thumb background survives`, state?.bg === THUMB_BG);
}

// Markers are opt-in: a ScrollView without a provider must paint none.
const plain = new ScrollView(new Text(lines.join("\n"), 0, 0), {
  follow: "end",
  primary: true,
  scrollbar: "always",
  scrollbarStyle: (text) => `\x1b[48;${THUMB_BG}m${text}\x1b[49m`,
});
const plainRoot = new VStack([{ component: plain, basis: 0, grow: 1, shrink: 1, minSize: 1 }]);
renderLayoutFrame(plainRoot, 40, 24, () => {});
const plainFrame = renderLayoutFrame(plainRoot, 40, 24, () => {});
assert("no markers without a provider", !plainFrame.lines.some((line) => line.includes("\u2584")));

if (failed) {
  console.error(`\n${failed} patch assertion(s) failed`);
  process.exit(1);
}
console.log("\nall patch assertions passed");
