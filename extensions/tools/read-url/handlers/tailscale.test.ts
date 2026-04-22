import { describe, expect, it, vi } from "vitest";
import { createTailscaleHandler } from "./tailscale";

describe("tailscale read_url handler", () => {
  it("matches *.ts.net domains", () => {
    const handler = createTailscaleHandler();
    expect(
      handler.matches(new URL("https://my-machine.tail1234.ts.net/api/status")),
    ).toBe(true);
    expect(handler.matches(new URL("https://server.ts.net/"))).toBe(true);
    expect(handler.matches(new URL("http://dev.box.ts.net:3000/health"))).toBe(
      true,
    );
  });

  it("does not match non-ts.net domains", () => {
    const handler = createTailscaleHandler();
    expect(handler.matches(new URL("https://example.com/"))).toBe(false);
    expect(handler.matches(new URL("https://ts.net/"))).toBe(false);
    expect(handler.matches(new URL("https://not-tailscale.ts.network/"))).toBe(
      false,
    );
  });

  it("fetches URL directly and returns body as-is", async () => {
    const handler = createTailscaleHandler();
    const body = '{"status":"ok","uptime":12345}';

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await handler.fetchData(
      new URL("https://myapp.tail1234.ts.net/api/status"),
      undefined,
    );

    expect(result.sourceUrl).toBe("https://myapp.tail1234.ts.net/api/status");
    expect(result.markdown).toBe(body);
    expect(result.statusCode).toBe(200);
    expect(result.title).toBeUndefined();

    vi.restoreAllMocks();
  });

  it("throws on non-2xx responses", async () => {
    const handler = createTailscaleHandler();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Not Found", {
          status: 404,
          statusText: "Not Found",
          headers: { "content-type": "text/plain" },
        }),
      ),
    );

    await expect(
      handler.fetchData(
        new URL("https://myapp.tail1234.ts.net/missing"),
        undefined,
      ),
    ).rejects.toThrow("HTTP 404");

    vi.restoreAllMocks();
  });
});
