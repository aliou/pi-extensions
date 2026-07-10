// Patch test: pi-ai -- disable request body compression in openai-codex-responses.
//
// Drives the `stream()` SSE path (transport: "sse") with a mocked global
// `fetch` that captures the outgoing request, then asserts:
//   - no `content-encoding: zstd` header is set, and
//   - the request body is the raw uncompressed JSON string (not zstd bytes).
//
// On unpatched @earendil-works/pi-ai@0.80.6, `compressRequestBodyZstd` returns
// a zstd-compressed Uint8Array (magic bytes 0x28 0xB5 0x2F 0xFD) and the SSE
// path sets `content-encoding: zstd` — so both assertions fail, guarding the
// patch. (Node 22 ships `zlib.zstdCompressSync`, so compression is active on
// unpatched code.)

import assert from "node:assert/strict";
import { stream } from "@earendil-works/pi-ai/api/openai-codex-responses";

let captured = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  captured = {
    url: String(url),
    headers: new Headers(init.headers),
    body: init.body,
  };
  // Non-retryable error response so the stream settles quickly (maxRetries: 0).
  return new Response(JSON.stringify({ error: { message: "test" } }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
};

try {
  const model = {
    provider: "openai-codex",
    id: "gpt-5",
    baseUrl: "https://chatgpt.com/backend-api",
    headers: {},
    thinkingLevelMap: {},
    input: ["text", "image"],
  };
  const context = { systemPrompt: "test", messages: [], tools: [] };
  const ev = stream(model, context, {
    apiKey:
      "eyJhbGciOiJub25lIIsidHlwIjoiSldUIn0.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsiY2hhdGdwdF9hY2NvdW50X2lkIjoiYWNjdF90ZXN0MTIzIn19.sig",
    transport: "sse",
    maxRetries: 0,
  });
  // Drain the stream until it settles (done/error).
  for await (const _event of ev) {
    // swallow
  }
} finally {
  globalThis.fetch = originalFetch;
}

if (!captured) {
  console.error("FAIL: fetch was never called");
  process.exit(1);
}

const encoding = captured.headers.get("content-encoding");
assert.notEqual(encoding, "zstd", "content-encoding: zstd must not be set");
console.log("ok - no content-encoding: zstd header");

assert.equal(typeof captured.body, "string", "request body must be an uncompressed JSON string, not zstd bytes");
console.log("ok - request body is an uncompressed string");

// On unpatched code the body would be a zstd Uint8Array starting with the
// zstd magic bytes 0x28 0xB5 0x2F 0xFD. Guard explicitly against that.
if (typeof captured.body === "string") {
  assert.doesNotMatch(captured.body, /^\u0028\u00b5\u002f\u00fd/, "body must not start with the zstd magic bytes");
}
// Body must parse as the JSON request we built.
const parsed = JSON.parse(captured.body);
assert.equal(parsed.model, "gpt-5", "body must be the JSON request (model=gpt-5)");
console.log("ok - request body parses as JSON request");

console.log("all patch assertions passed");
