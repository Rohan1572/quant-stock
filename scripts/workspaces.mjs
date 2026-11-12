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
  for (const pattern of pkg.workspaces ?? [])
    addWorkspacePattern(pattern, dirs);
  return [...dirs];
}

function addWorkspacePattern(pattern, dirs) {
  if (typeof pattern !== "string") {
    throw new TypeError(`Invalid workspace pattern: ${String(pattern)}`);
  }
  if (!isSupportedPattern(pattern)) {
    throw new Error(
      `Unsupported workspace pattern "${pattern}"; use a directory path or a direct-child pattern (dir/*).`,
    );
  }

  if (pattern.endsWith("/*")) {
    addChildWorkspaces(pattern, dirs);
    return;
  }

  const direct = path.join(root, pattern);
  if (fs.existsSync(path.join(direct, "package.json"))) dirs.add(direct);
}

function isSupportedPattern(pattern) {
  if (!hasGlobSyntax(pattern)) return true;
  return pattern.endsWith("/*") && !hasGlobSyntax(pattern.slice(0, -2));
}

function addChildWorkspaces(pattern, dirs) {
  const parent = path.join(root, pattern.slice(0, -2));
  if (!fs.existsSync(parent)) return;

  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const workspace = path.join(parent, entry.name);
    if (fs.existsSync(path.join(workspace, "package.json")))
      dirs.add(workspace);
  }
}

function hasGlobSyntax(pattern) {
  return (
    pattern.startsWith("!") ||
    ["*", "?", "[", "]", "{", "}"].some((character) =>
      pattern.includes(character),
    )
  );
}
