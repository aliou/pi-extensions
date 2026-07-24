import type { ProviderHeaders } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { addSessionIdHeader, SESSION_ID_HEADER } from "./session-id";

function headers(input: Record<string, string | null>): ProviderHeaders {
  return { ...input };
}

describe("addSessionIdHeader", () => {
  it("sets the header when absent", () => {
    const h = headers({});
    addSessionIdHeader(h, "sess-123");
    expect(h[SESSION_ID_HEADER]).toBe("sess-123");
  });

  it("does not overwrite an existing value (case-insensitive)", () => {
    const h = headers({ "X-Session-Id": "aperture-value" });
    addSessionIdHeader(h, "sess-123");
    expect(h["X-Session-Id"]).toBe("aperture-value");
    expect(h[SESSION_ID_HEADER]).toBeUndefined();
  });

  it("ignores an empty session id", () => {
    const h = headers({});
    addSessionIdHeader(h, undefined);
    addSessionIdHeader(h, "");
    expect(h[SESSION_ID_HEADER]).toBeUndefined();
  });
});
