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
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json"];

/** Every workspace directory from the root package.json, plus the root itself. */
function workspaces() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const dirs = new Set([root]);
  for (const pattern of pkg.workspaces ?? []) {
    // Only the simple "dir/*" form is used here; anything else is a no-op
    // rather than a silently wrong guess.
    if (!pattern.endsWith("/*")) {
      const direct = path.join(root, pattern);
      if (fs.existsSync(direct)) dirs.add(direct);
      continue;
    }
    const parent = path.join(root, pattern.slice(0, -2));
    if (!fs.existsSync(parent)) continue;
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        fs.existsSync(path.join(parent, entry.name, "package.json"))
      ) {
        dirs.add(path.join(parent, entry.name));
      }
    }
  }
  return [...dirs];
}

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
