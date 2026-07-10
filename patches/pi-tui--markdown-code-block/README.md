# pi-tui -- markdown code-block rendering patch

## What this patch does

Reworks how fenced code blocks are rendered in `@earendil-works/pi-tui`'s
`Markdown` component (`dist/components/markdown.js`).

Before: code blocks were drawn with ``` fences and a trailing blank line:

```
```js
  const x = 1
```
```

After: code blocks are drawn as an indented block with a tinted background and
top/bottom padding bars (`▀` / `▄`), with no surrounding blank lines:

```
▀▀▀▀
  const x = 1
▄▄▄
```

### Changes

- Adds `renderCodeBlock(code, lang, availableWidth)` which renders the block
  with `▀`/`▄` padding bars (via `theme.codeBlockPaddingTop` /
  `theme.codeBlockPaddingBottom`, falling back to `theme.codeBlock`), indents
  the code by two spaces, and pads each line to the full width so the tinted
  background spans the whole block.
- `renderToken` now takes a `prevTokenType` argument (threaded from the render
  loop) and delegates `code` tokens to `renderCodeBlock`.
- The `space` token handler skips blank lines that sit directly adjacent to a
  code block (`prevTokenType === "code" || nextTokenType === "code"`), since
  the block now supplies its own padding.

## Files

- `patch.diff` — unified diff applied to the installed package's
  `dist/components/markdown.js` by `pnpm.patchedDependencies` (declared in
  `patches/package.json`).
- `test.mjs` — imports the patched `Markdown` by package name
  (`@earendil-works/pi-tui/dist/components/markdown.js`) and asserts the new
  rendering. Fails on unpatched code, so it actually guards the patch.

## How it is applied & tested

The patch is hardcoded in `patches/package.json` under
`pnpm.patchedDependencies`:

```json
"pnpm": {
  "patchedDependencies": {
    "@earendil-works/pi-tui@0.80.6": "./pi-tui--markdown-code-block/patch.diff"
  }
}
```

`pnpm install` in `patches/` resolves `@earendil-works/pi-tui` and applies
`patch.diff` to it automatically. The test then imports the patched package by
name — no extraction, apply, or dep-linking step at test time. Just the test.

Run: `pnpm -C patches install && pnpm test:patches`.

## Testing against a new pi-tui release

Authored against 0.80.2; applies cleanly to 0.80.3 and 0.80.6 (latest). The
`Patches` workflow runs a nightly job that bumps `patches/package.json` to the
latest published pi-tui (via `scripts/bump-pi-version.mjs`), reinstalls, and
re-runs this test. If the patch no longer applies to the new version, `pnpm
install` fails and the job goes red — rebase `patch.diff` onto the new source.

To check manually: `PI_VERSION=<ver> node scripts/bump-pi-version.mjs &&
pnpm -C patches install && pnpm test:patches`.
