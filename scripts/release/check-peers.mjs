#!/usr/bin/env node
// Fails when an adapter's published peer range for svelte-gridlite-kit doesn't
// include the core package's current version, or leaks `workspace:` (npm
// publish doesn't rewrite it). Guards against #27, #30, #35 and #41.
//
// Peer ranges must be a caret range (^X.Y.Z). Under 0.x, ^0.Y.Z matches
// 0.Y.Z and later patches of 0.Y only.
import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url)));
const core = read("packages/core/package.json");
const adapters = ["packages/pglite/package.json", "packages/tanstack-db/package.json"];

const parse = (v) => v.split(".").map(Number);
function caretIncludes(range, version) {
  const m = /^\^(\d+\.\d+\.\d+)$/.exec(range);
  if (!m) return false;
  const [rMaj, rMin, rPat] = parse(m[1]);
  const [vMaj, vMin, vPat] = parse(version.split("-")[0]);
  if (rMaj > 0) return vMaj === rMaj && (vMin > rMin || (vMin === rMin && vPat >= rPat));
  return vMaj === 0 && vMin === rMin && vPat >= rPat;
}

let failed = false;
for (const path of adapters) {
  const pkg = read(path);
  const range = pkg.peerDependencies?.[core.name];
  if (!range || !caretIncludes(range, core.version)) {
    console.error(
      `✗ ${pkg.name}@${pkg.version}: peer ${core.name} "${range}" must be a caret range including ${core.version}`,
    );
    failed = true;
  } else {
    console.log(`✓ ${pkg.name}@${pkg.version}: peer ${core.name} "${range}" includes ${core.version}`);
  }
}
process.exit(failed ? 1 : 0);
