# pi-tui -- scrollbar markers patch

## What this patch does

Lets a `ScrollView` paint markers on its scrollbar track, so a caller can show
where things of interest sit in a long document — the way an editor minimap
marks search hits. `@earendil-works/pi-coding-agent` uses it to mark labels in
the fullscreen transcript (see `pi-coding-agent--scrollbar-markers`).

Before: the scrollbar drew a thumb and nothing else.

After: `ScrollView` accepts two new options and one writable field:

| Option | Type | Meaning |
|---|---|---|
| `scrollbarMarkerStyles` | `Record<string, (text: string) => string>` | Style per marker kind |
| `scrollbarMarkers` | `() => ScrollbarMarker[]` | Marker provider, also assignable after construction |

A `ScrollbarMarker` is `{ position: number; kind: string }`, where `position` is
a fraction of the scroll content (0 = top, 1 = bottom) and `kind` selects the
style. The provider is called every paint, so markers follow reflow without
being cached or invalidated. Markers are opt-in: without a provider the
scrollbar renders exactly as before.

## Compositing rules

Markers are painted after the thumb and win over it, keeping the underlying
cell's character. The background is decided from the scrollbar geometry, never
sniffed from the painted row — the transcript paints message backgrounds that
reach the scrollbar column, and those must not leak into a marker:

- **Off the thumb**, the background is explicitly reset, so the marker renders
  against the terminal default whatever the row underneath painted.
- **On the thumb**, the marker's own background resets are stripped and the
  thumb's background is applied instead. With a half-block glyph (`▄`) the
  marker shows its color in the glyph half and the thumb color in the other,
  so the thumb stays readable underneath.

The thumb background is read from `scrollbarStyle(" ")` rather than from the
row, because a style closes the background it opens and the row cannot be told
apart from a message background.

## Files

- `patch.diff` — unified diff against the installed package's `dist/layout.js`,
  `dist/index.js`, and `dist/components/scroll-view.js`.
- `test.mjs` — sweeps every scroll position of a transcript whose lines carry a
  background reaching the scrollbar column, resolving the SGR state at each
  marker glyph. Asserts the marker is always painted, always keeps its color,
  takes the thumb background when over the thumb, and never inherits the
  message background otherwise. Fails on unpatched code, where `scrollbarMarkers`
  is ignored and no glyph is painted.

`dist/index.js` also re-exports `LAYOUT_NODE`, which the coding-agent patch
needs to measure component heights.

## How it is applied & tested

`patches/manifest.json` lists this directory under
`@earendil-works/pi-tui`. `pnpm patches:sync` flattens that package's patches,
in manifest order, into `patches/combined/pi-tui.diff` and points
`pnpm.patchedDependencies` at it, because pnpm accepts only one patch file per
package. Nix applies each patch directory in succession instead; both produce
identical output.

Run: `pnpm -C patches install && pnpm test:patches`.

## Testing against a new pi-tui release

Authored and verified against 0.84.1. The `Patches` workflow runs a nightly job
that bumps `patches/package.json` to the latest published Pi release (via
`scripts/bump-pi-version.mjs`), reinstalls, and re-runs this test. If the patch
no longer applies, `pnpm install` fails and the job goes red — rebase
`patch.diff` onto the new source.

To check manually: `PI_VERSION=<ver> node scripts/bump-pi-version.mjs &&
pnpm -C patches install && pnpm test:patches`.
