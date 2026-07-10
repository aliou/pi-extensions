#!/usr/bin/env node
// @aliou/pi-harness patch test runner.
//
// Runs each `patches/<name>/test.mjs` with node. Tests import the patched
// package by name (e.g. `@earendil-works/pi-tui/...`), which resolves from
// `patches/node_modules` — produced by `pnpm install` in patches/ applying the
// patches declared in `patches/package.json` via `pnpm.patchedDependencies`.
//
// So there is no apply/extract step here: pnpm install applies the patches,
// and this script just runs the tests.
//
// Usage:
//   node scripts/run-patch-tests.mjs              # run all patches/*/test.mjs
//   node scripts/run-patch-tests.mjs <dir>...     # run specific patch dirs

import { spawnSync } from "node:child_process";
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const PATCHES_DIR = path.resolve("patches");

function listTests(targets) {
  const dirs = targets.length
    ? targets.map((t) => path.resolve(t))
    : readdirSync(PATCHES_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(PATCHES_DIR, e.name));
  return dirs
    .map((d) => path.join(d, "test.mjs"))
    .filter((t) => existsSync(t));
}

const tests = listTests(process.argv.slice(2));
if (tests.length === 0) {
  console.log("no patch tests found under patches/");
  process.exit(0);
}

let failed = 0;
for (const test of tests) {
  const name = path.basename(path.dirname(test));
  process.stdout.write(`\n=== ${name} ===\n`);
  const res = spawnSync("node", [test], { stdio: "inherit" });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    console.error(`FAIL ${name}`);
    failed++;
  } else {
    console.log(`PASS ${name}`);
  }
}

if (failed) {
  console.error(`\n${failed} patch test(s) failed`);
  process.exit(1);
}
console.log("\nall patch tests passed");
