# pi-coding-agent -- transcript label markers patch

## What this patch does

Marks labels on the fullscreen transcript scrollbar, so the points worth
returning to in a long session can be found at a glance. Requires the
`pi-tui--scrollbar-markers` patch, which adds the marker support this feeds.

Before: the fullscreen scrollbar showed only a thumb, and `/label` left no
visible trace anywhere in the transcript.

After: the transcript `ScrollView` gets a marker provider that marks any
component whose entry carries a label with a square in the warning color the
session tree already uses for labels. Nothing else is marked — user messages,
assistant output, tools, and notices all render unmarked, so the scrollbar stays
quiet until a label is added.

Markers are half-block glyphs (`▄`). A terminal cell is about twice as tall as
it is wide, so a half block reads as a square rather than a bar.

Because only labels are marked, the provider returns early when nothing is
labeled, which is the common case: no transcript component is measured.

## Resolving labels

A label is its own session entry (`type: "label"` with a `targetId`) and renders
nothing in the transcript, so the marker has to be placed on the component of
the entry the label points at.

`/label` labels the session leaf, which after a completed turn is the
**assistant** entry — so assistant messages must be matchable, not just user
ones. Components are matched to entries by:

1. **Object identity** for message entries. `sessionEntryToContextMessages()`
   returns the very same `AgentMessage` instance the entry holds, and
   `getEntries()` returns live entries rather than copies, so the instance a
   component rendered is the instance the entry stores.
2. **Entry id** for custom entries, which carry their entry directly.
3. **Message text** for user messages, as a fallback, since
   `UserMessageComponent` keeps text rather than the message.

Label state comes from `sessionManager.getLabel()`, so a label that was later
cleared stops showing a marker.

## Files

- `patch.diff` — unified diff against the installed package's
  `dist/modes/interactive/interactive-mode.js`. Adds `getTranscriptMarkers`,
  `getLabeledTranscriptTargets`, `getTranscriptMarkerKind`, and
  `measureComponentHeight`, and wires the marker styles and provider into the
  transcript `ScrollView`.
- `test.mjs` — exercises the classifier on the patched prototype: unlabeled
  components get no marker, and labeled entries get one whether matched by
  message identity, entry id, or text. Fails on unpatched code, where the
  methods do not exist.

The marker provider itself needs a live session, so the test covers the pure
classification rather than end-to-end placement.

## How it is applied & tested

`patches/manifest.json` lists this directory under
`@earendil-works/pi-coding-agent`. `pnpm patches:sync` flattens that package's
patches, in manifest order, into `patches/combined/pi-coding-agent.diff` and
points `pnpm.patchedDependencies` at it, because pnpm accepts only one patch
file per package. Nix applies each patch directory in succession instead; both
produce identical output.

Run: `pnpm -C patches install && pnpm test:patches`.

## Testing against a new pi-coding-agent release

Authored and verified against 0.84.1. The `Patches` workflow runs a nightly job
that bumps `patches/package.json` to the latest published Pi release (via
`scripts/bump-pi-version.mjs`), reinstalls, and re-runs this test. If the patch
no longer applies, `pnpm install` fails and the job goes red — rebase
`patch.diff` onto the new source.

To check manually: `PI_VERSION=<ver> node scripts/bump-pi-version.mjs &&
pnpm -C patches install && pnpm test:patches`.
