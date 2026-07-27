import { getLanguageFromPath } from "@earendil-works/pi-coding-agent";

let failed = 0;
const assert = (name, cond) => {
  console.log(`${cond ? "ok" : "not ok"} - ${name}`);
  if (!cond) failed++;
};

const cases = [
  ["component.astro", "astro"],
  ["change.diff", "diff"],
  ["config.hujson", "json"],
  ["settings.jsonc", "json"],
  ["lines.jsonl", "json"],
  ["justfile", "makefile"],
  ["page.mdx", "markdown"],
  ["module.mts", "typescript"],
  ["flake.nix", "nix"],
  ["script.nu", "nu"],
  ["main.zig", "zig"],
];

for (const [file, expected] of cases) {
  assert(`${file} maps to "${expected}"`, getLanguageFromPath(file) === expected);
}

if (failed) {
  console.error(`\n${failed} patch assertion(s) failed`);
  process.exit(1);
}
console.log("\nall patch assertions passed");
