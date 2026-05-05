import { describe, expect, it } from "vitest";
import { parseGistUrl } from "./gist";

describe("gist read_url handler", () => {
  it("parses gist URLs with usernames", () => {
    const parsed = parseGistUrl(
      new URL("https://gist.github.com/aliou/0123456789abcdef0123456789abcdef"),
    );

    expect(parsed).toEqual({
      gistId: "0123456789abcdef0123456789abcdef",
    });
  });

  it("parses gist URLs without usernames", () => {
    const parsed = parseGistUrl(
      new URL("https://gist.github.com/0123456789abcdef0123456789abcdef"),
    );

    expect(parsed).toEqual({
      gistId: "0123456789abcdef0123456789abcdef",
    });
  });

  it("ignores file anchors on gist URLs", () => {
    const parsed = parseGistUrl(
      new URL(
        "https://gist.github.com/aliou/0123456789abcdef0123456789abcdef#file-example-ts",
      ),
    );

    expect(parsed).toEqual({
      gistId: "0123456789abcdef0123456789abcdef",
    });
  });

  it("rejects non-gist GitHub URLs", () => {
    const parsed = parseGistUrl(new URL("https://github.com/aliou/pi-harness"));
    expect(parsed).toBeNull();
  });

  it("rejects gist URLs without a valid id", () => {
    const parsed = parseGistUrl(
      new URL("https://gist.github.com/aliou/not-a-gist"),
    );
    expect(parsed).toBeNull();
  });
});
