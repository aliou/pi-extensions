# pi-ai -- disable request body compression in openai-codex-responses

## What this patch does

Disables zstd request-body compression in the `openai-codex-responses` provider
of `@earendil-works/pi-ai` (`dist/api/openai-codex-responses.js`).

Since [pi commit `0ac3cfe`](https://github.com/earendil-works/pi/commit/0ac3cfe09b8558865c3c73e405445aafadae3c5a)
(released in v0.80.4), the Codex SSE responses path compresses the request body
with zstd and sets `Content-Encoding: zstd` when `node:zlib.zstdCompressSync` is
available (Node 22+). This matches the official Codex client.

The problem: most proxies that monitor usage/tokens/cache or inject credentials
do not accept compressed request bodies. This patch makes `compressRequestBodyZstd`
always return `null`, so the caller falls back to sending the uncompressed JSON
and skips the `Content-Encoding: zstd` header — restoring pre-0.80.4 behavior.

The WebSocket transport already sends an uncompressed JSON frame and is
unchanged; only the SSE path is affected.

Upstream feature request: https://github.com/earendil-works/pi/issues/6483

### Change

`compressRequestBodyZstd(bodyJson)` is replaced with an early `return null`:

```js
function compressRequestBodyZstd(bodyJson) {
    // PATCHED (@aliou/pi-harness): request body compression disabled.
    // The Codex SSE endpoint accepts zstd-compressed bodies, but most
    // monitoring/credential-injection proxies do not. Returning null makes the
    // caller fall back to sending the uncompressed JSON and skip the
    // `content-encoding: zstd` header. See
    // https://github.com/earendil-works/pi/issues/6483
    return null;
}
```

The call site already handles `null` correctly: `const sseBody = compressedBody ?? bodyJson;` and the `if (compressedBody) { sseHeaders.set("content-encoding", "zstd"); }` guard is skipped.

## Files

- `patch.diff` — unified diff applied to the installed package's
  `dist/api/openai-codex-responses.js` by `pnpm.patchedDependencies` (declared
  in `patches/package.json`).
- `test.mjs` — drives the `stream()` SSE path (`transport: "sse"`) with a
  mocked global `fetch` that captures the outgoing request, then asserts no
  `content-encoding: zstd` header and an uncompressed JSON body. Fails on
  unpatched code (compression is active on Node 22+), so it guards the patch.

## How it is applied & tested

Declared in `patches/package.json`:

```json
"pnpm": {
  "patchedDependencies": {
    "@earendil-works/pi-ai@0.80.6": "./pi-ai--disable-request-compression/patch.diff"
  }
}
```

`pnpm -C patches install` resolves `@earendil-works/pi-ai` and applies the
patch automatically; the test imports the patched package by name. Run:
`pnpm -C patches install && pnpm test:patches`.

## Testing against a new pi-ai release

Applies cleanly to 0.80.6 (latest). The `Patches` workflow's nightly job bumps
`patches/package.json` to the latest published pi-ai and re-runs this test; if
the patch no longer applies or the test breaks, rebase `patch.diff` onto the
new source. Note: compression was introduced in 0.80.4 — versions before that
have no compression to disable, so the patch would no-op (the test still
passes since there's nothing to compress). When upstream adds a config flag
(issue #6483), this patch can be dropped in favor of it.
