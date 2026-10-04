/**
 * Shared workspace discovery for the repository scripts.
 *
 * Read from the root package.json rather than a hardcoded list, so adding a
 * workspace cannot silently drop out of `npm run clean` or `npm run reinstall`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Every workspace directory declared in the root package.json, plus the root. */
export function workspaces() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  const dirs = new Set([root]);
  for (const pattern of pkg.workspaces ?? []) {
    // Only the simple "dir/*" form is used here; anything else resolves the
    // literal path rather than guessing at a glob.
    if (!pattern.endsWith("/*")) {
      const direct = path.join(root, pattern);
      if (fs.existsSync(path.join(direct, "package.json"))) dirs.add(direct);
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
