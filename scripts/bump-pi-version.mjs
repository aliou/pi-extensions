#!/usr/bin/env node
// @aliou/pi-harness pi-version bumper for the patches project.
//
// Rewrites `patches/package.json` to point its `@earendil-works/*` dependencies
// at a target version, and rewrites the matching `pnpm.patchedDependencies`
// keys (which are version-pinned as `pkg@<version>`) so `pnpm install` in
// patches/ re-resolves and re-applies the patches against that version.
//
// This lets the nightly workflow test patches against a newer pi release
// without touching the repo's main package.json. The change is ephemeral in CI
// (not committed); locally, review the diff before committing to pin.
//
// Target version resolution (first match wins):
//   1. PI_VERSION env var — applied to every @earendil-works/* dep.
//   2. Each package's latest published version (`npm view <pkg> version`).
//
// Usage:
//   node scripts/bump-pi-version.mjs                 # bump each to its latest
//   PI_VERSION=0.80.6 node scripts/bump-pi-version.mjs   # bump all to a specific version

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PKG_FILE = "patches/package.json";
const SCOPE = "@earendil-works";

const pkg = JSON.parse(readFileSync(PKG_FILE, "utf8"));
const deps = Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith(`${SCOPE}/`));
if (deps.length === 0) {
  console.error(`no ${SCOPE}/* dependencies found in ${PKG_FILE}`);
  process.exit(1);
}

const patched = pkg.pnpm?.patchedDependencies ?? {};

let changed = false;
for (const dep of deps) {
  const current = pkg.dependencies[dep];
  const target = process.env.PI_VERSION || execSync(`npm view ${dep} version`, { encoding: "utf8" }).trim();
  if (!target) {
    console.error(`could not resolve target version for ${dep}`);
    process.exit(1);
  }
  if (current === target) {
    console.log(`${dep}: already at ${target}`);
    continue;
  }
  console.log(`${dep}: ${current} -> ${target}`);
  pkg.dependencies[dep] = target;

  const oldKey = `${dep}@${current}`;
  const newKey = `${dep}@${target}`;
  if (oldKey in patched) {
    patched[newKey] = patched[oldKey];
    delete patched[oldKey];
    console.log(`  patchedDependencies: ${oldKey} -> ${newKey}`);
  }
  changed = true;
}

if (!changed) {
  console.log("no changes");
  process.exit(0);
}

pkg.pnpm ??= {};
pkg.pnpm.patchedDependencies = patched;
writeFileSync(PKG_FILE, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`bumped ${PKG_FILE}`);
