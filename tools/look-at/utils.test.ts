import { describe, expect, it } from "vitest";
import { detectSupportedImageMimeType, referencesImageFiles } from "./utils";

describe("referencesImageFiles", () => {
  it.each([
    // ── Real user messages from sessions ────────────────────────────────
    {
      desc: "screenshot with trailing prose",
      input:
        "why does it duplicate my message? /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-01 at 08.49.52 PM@2x.png on submit it showed mine with blue bg and again in grey",
    },
    {
      desc: "screenshot in middle of multi-sentence message",
      input:
        "fix the detail view issues when there are images. for long form articles (like this one /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-05 at 08.15.30 PM@2x.png ) make sure to render the correct data",
    },
    {
      desc: "two screenshots side by side",
      input:
        "/Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-10 at 12.18.39 PM@2x.png /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-10 at 12.18.32 PM@2x.png\n\nwhen collapsed, you can see the",
    },
    {
      desc: "screenshot at end of short message",
      input:
        "here's what i see in the ui : /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-04 at 01.03.43 PM@2x.png",
    },
    {
      desc: "screenshot after frustrated opener",
      input:
        "show the tool calls inline instead of try to do some cleanup. /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-01 at 08.17.02 PM@2x.png",
    },
    {
      desc: "screenshot with instruction after it",
      input:
        "ok, now make a version that is suitable for discord: /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-04-15 at 06.36.59 PM@2x.png focus on the quality",
    },
    {
      desc: "two screenshots with commentary between",
      input:
        "some stuff seem to have been lost : /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-09 at 07.06.01 PM@2x.png the previous version was better. /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-09 at 07.06.33 PM@2x.png",
    },
    {
      desc: "screenshots on own lines after prose",
      input:
        "ok, restart the server and then tell me how to test this:\n/Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-11 at 12.32.49 PM@2x.png\n/Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-11 at 12.32.53 PM@2x.png",
    },
    {
      desc: "jpeg from clipboard path",
      input:
        "seems like it still fails /Users/alioudiallo/Library/Group Containers/group.com.apple.coreservices.useractivityd/shared-pasteboard/items/B412A257-6609-4E86-B0C1-B1880CAC193D/IMG_4738.jpeg here's the output",
    },
    {
      desc: "png inside deeply nested dir with spaces",
      input:
        "in particular, the photo of the box: /Users/alioudiallo/Downloads/Playdate Media Kit 4.0/Playdate photos/Playdate-box-photo-1.png",
    },
    {
      desc: "screenshot after code block",
      input:
        "```\n── Tic-Tac-Toe ──\n   ○  │     │  ✕\n─────┼─────┼─────\n     │     │\n─────┼─────┼─────\n     │     │\n```\n\n/Users/alioudiallo/Pictures/screenshots/Screenshot 2026-04-17 at 03.35.59 PM@2x.png",
    },
    {
      desc: "screenshot after list",
      input:
        "there's seems to be an issue: in the dashboard i see this: /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-04-13 at 04.44.13 PM@2x.png\n\nthis deosnt' match what we show currently",
    },
    {
      desc: "screenshot as only content",
      input:
        "/Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-30 at 09.08.32 PM@2x.png",
    },
    {
      desc: "screenshot after 'now seeing nothing:'",
      input:
        "now seeting nothing: /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-04-02 at 10.30.03 AM@2x.png",
    },
    {
      desc: "bare relative path to png",
      input: "read packages/ai/test/data/red-circle.png",
    },
    {
      desc: "screen recording with frame as png",
      input:
        "seeing /Users/alioudiallo/Pictures/screenshots/Screenshot 2026-03-15 at 01.15.44 PM@2x.png",
    },
    // ── Simple path-only cases ────────────────────────────────────────
    {
      desc: "jpg at end of string",
      input: "/Users/alioudiallo/Desktop/mindful-palettes/MP072.jpg",
    },
    {
      desc: "jpeg from photos library",
      input:
        "/Users/alioudiallo/Pictures/Photos Library.photoslibrary/resources/derivatives/1/187EACAF-45D6-4917-B8BE-9362A6E8849F_1_102_o.jpeg",
    },
    {
      desc: "webp extension",
      input: "check this out ~/screenshots/diagram.webp please",
    },
    {
      desc: "gif extension",
      input: "look at demo.gif",
    },
  ])("detects image: $desc", ({ input }) => {
    expect(referencesImageFiles(input)).toBe(true);
  });

  it.each([
    { desc: "plain text", input: "read this file src/index.ts" },
    { desc: "empty string", input: "" },
    {
      desc: "PNG as a word in prose",
      input: "I converted the PNG data to base64",
    },
    {
      desc: ".ts file path",
      input: "look at extensions/tools/look-at/index.ts",
    },
    { desc: "png in domain name", input: "check https://png.example.com/api" },
    { desc: ".json file", input: "read package.json" },
    { desc: "word with png-like ending", input: "the mapping function" },
    { desc: ".md file", input: "read README.md" },
    {
      desc: "real message with no images",
      input:
        "ok, restart the server and then tell me how to test this. make sure the env vars are set correctly.",
    },
    {
      desc: "code block only",
      input: "```\nconst x = 42;\nconsole.log(x);\n```\n\nthat's what i got.",
    },
    { desc: "svg extension", input: "the logo is at assets/logo.svg" },
    { desc: "bmp extension", input: "the bitmap is at assets/image.bmp" },
  ])("rejects non-image: $desc", ({ input }) => {
    expect(referencesImageFiles(input)).toBe(false);
  });
});

describe("detectSupportedImageMimeType", () => {
  it.each([
    {
      desc: "png",
      input: Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000049444154",
        "hex",
      ),
      expected: "image/png",
    },
    {
      desc: "jpeg",
      input: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      expected: "image/jpeg",
    },
    {
      desc: "gif",
      input: Buffer.from("GIF89a", "ascii"),
      expected: "image/gif",
    },
    {
      desc: "webp",
      input: Buffer.from("RIFFxxxxWEBP", "ascii"),
      expected: "image/webp",
    },
  ])("detects $desc", ({ input, expected }) => {
    expect(detectSupportedImageMimeType(input)).toBe(expected);
  });

  it("rejects h264 bytes mislabeled as png by extension", () => {
    const h264Bytes = Buffer.from([
      0x00, 0x00, 0x00, 0x01, 0x67, 0x64, 0x00, 0x2a,
    ]);

    expect(detectSupportedImageMimeType(h264Bytes)).toBeNull();
  });

  it("rejects invalid png signature without IHDR", () => {
    const invalidPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    expect(detectSupportedImageMimeType(invalidPng)).toBeNull();
  });
});
