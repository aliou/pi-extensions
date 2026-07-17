import { describe, expect, it } from "vitest";
import { escapeXml } from "./xml";

describe("escapeXml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });

  it("escapes ampersand before other entities", () => {
    expect(escapeXml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeXml("plain text 123")).toBe("plain text 123");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });
});
