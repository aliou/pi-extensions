import { Markdown } from "@earendil-works/pi-tui/dist/components/markdown.js";

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const noop = (s) => s;
const theme = {
  codeBlock: noop,
  codeBlockPaddingTop: noop,
  codeBlockPaddingBottom: noop,
  bold: noop,
  italic: noop,
  strikethrough: noop,
  underline: noop,
  heading: noop,
  code: noop,
  link: noop,
  linkUrl: noop,
  quote: noop,
  quoteBorder: noop,
  hr: noop,
  listBullet: noop,
  codeBlockBorder: noop,
};

const W = 40;
const doc = "para1\n\n```js\nconst x = 1\n```\n\npara2";
const md = new Markdown(doc, 0, 0, theme, undefined, {});
const lines = md.render(W).map(strip);

let failed = 0;
const assert = (name, cond) => {
  console.log(`${cond ? "ok" : "not ok"} - ${name}`);
  if (!cond) failed++;
};

assert("no ``` fences in output", !lines.some((l) => l.includes("```")));
assert("has top padding line (▀)", lines.some((l) => l === "▀".repeat(W)));
assert("has bottom padding line (▄)", lines.some((l) => l === "▄".repeat(W)));
assert("code text is rendered", lines.some((l) => l.includes("const x = 1")));
assert("no blank lines around the block", !lines.some((l) => l.trim() === ""));

if (failed) {
  console.error(`\n${failed} patch assertion(s) failed`);
  process.exit(1);
}
console.log("\nall patch assertions passed");
