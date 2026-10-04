/**
 * Removes every node_modules tree and lockfile in the repo, then reinstalls.
 *
 * Two things a plain `rm -rf node_modules` misses in a workspace repo:
 *
 *   - Nested node_modules under each artifact. npm hoists what it can, but
 *     keeps a nested copy when a workspace pins a conflicting version — this
 *     repo had esbuild 0.25.8 under artifacts/api-server while the root held
 *     0.28.2. Deleting only the root leaves that stale duplicate in place, so
 *     the "clean reinstall" does not actually produce a clean tree.
 *   - `.package-lock.json`, npm's hidden lockfile, which lives at
 *     node_modules/.package-lock.json and is recreated on install. The previous
 *     script looked for it at the repo root, where it never exists.
 *
 * package-lock.json is deleted too: this repo deliberately does not track it,
 * so a fresh resolve is the intended install.
 *
 * Run with `npm run reinstall`.
 */
import fs from "node:fs";
import path from "node:path";
import { root, workspaces } from "./workspaces.mjs";

const LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json"];

let removed = 0;
for (const dir of workspaces()) {
  const targets = [
    path.join(dir, "node_modules"),
    ...LOCKFILES.map((f) => path.join(dir, f)),
  ];
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`removed ${path.relative(root, target) || "."}`);
    removed++;
  }
}

console.log(removed === 0 ? "nothing to remove" : `${removed} removed`);
