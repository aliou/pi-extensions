# pi-coding-agent -- extra filetype highlighting patch

## What this patch does

Adds several file extensions to the `getLanguageFromPath()` language map in
`@earendil-works/pi-coding-agent`'s `dist/modes/interactive/theme/theme.js`.

Before: `.nix`, `.astro`, `.diff`, `.hujson`, `.jsonc`, `.jsonl`, `.mdx`,
`.mts`, `.nu`, `.zig`, and files named `justfile` had no language mapping, so
they were not syntax highlighted in the TUI.

After: those paths map to a sensible highlight.js language identifier:

| Extension / Filename | Mapped language |
|---|---|
| `.astro` | `astro` |
| `.diff` | `diff` |
| `.hujson` | `json` |
| `.jsonc` | `json` |
| `.jsonl` | `json` |
| `justfile` | `makefile` |
| `.mdx` | `markdown` |
| `.mts` | `typescript` |
| `.nix` | `nix` |
| `.nu` | `nu` |
| `.zig` | `zig` |

## Files

- `patch.diff` — unified diff against the installed package's
  `dist/modes/interactive/theme/theme.js`. Listed in `patches/manifest.json` and
  concatenated into the generated diff pnpm applies.
- `test.mjs` — imports the patched `getLanguageFromPath` by package name and
  asserts each new mapping. Fails on unpatched code, so it guards the patch.

## How it is applied & tested

`patches/manifest.json` lists this directory under
`@earendil-works/pi-coding-agent`:

```json
"@earendil-works/pi-coding-agent": [
  "pi-coding-agent--nix-highlighting"
]
```

`pnpm patches:sync` flattens that package's patches, in manifest order, into
`patches/combined/pi-coding-agent.diff` and points `pnpm.patchedDependencies` at
it, because pnpm accepts only one patch file per package. `pnpm install` in
`patches/` then applies the combined diff automatically, and the test imports the
patched package by name — no extraction, apply, or dep-linking step at test time.
Nix applies each patch directory in succession instead; both produce identical
output.

Run: `pnpm -C patches install && pnpm test:patches`.

## Testing against a new pi-coding-agent release

Authored against 0.82.0 and verified against 0.84.1. The `Patches` workflow runs a nightly job that bumps
`patches/package.json` to the latest published Pi release (via
`scripts/bump-pi-version.mjs`), reinstalls, and re-runs this test. If the patch
no longer applies to the new version, `pnpm install` fails and the job goes red
— rebase `patch.diff` onto the new source.

To check manually: `PI_VERSION=<ver> node scripts/bump-pi-version.mjs &&
pnpm -C patches install && pnpm test:patches`.
