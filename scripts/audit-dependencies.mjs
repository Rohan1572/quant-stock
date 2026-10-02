/**
 * Fails if any workspace imports a package it does not declare itself.
 *
 * Relies on transitive resolution otherwise, which works until an unrelated
 * package changes its dependency tree. Run with `npm run audit:deps`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WORKSPACES = [
  "artifacts/api-server",
  "artifacts/quantstock",
  "artifacts/mockup-sandbox",
  "lib/db",
  "lib/api-client-react",
  "lib/api-zod",
  "lib/api-spec",
  "scripts",
];

// Generated from the OpenAPI spec; regenerated rather than hand-maintained.
const SKIP_DIRS = new Set(["node_modules", "dist", "generated"]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function declaredFor(workspace) {
  const pkg = readJson(path.join(root, workspace, "package.json"));
  if (!pkg) return new Set();
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const declared = new Map(WORKSPACES.map((w) => [w, declaredFor(w)]));
const problems = [];

for (const workspace of WORKSPACES) {
  const own = declared.get(workspace);
  const files = walk(path.join(root, workspace));

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const specifiers = source.matchAll(
      /(?:from\s*|require\(\s*)["']([^"']+)["']/g,
    );

    for (const [, spec] of specifiers) {
      // Relative, absolute, node builtins and the "@/*" path alias are all
      // resolved by the toolchain rather than installed from a registry.
      if (/^[./]|^node:|^@\//.test(spec)) continue;

      if (spec.includes("node_modules")) {
        problems.push([file, spec, "deep import into node_modules"]);
        continue;
      }

      const parts = spec.split("/");
      const name = spec.startsWith("@")
        ? parts.slice(0, 2).join("/")
        : parts[0];
      if (!own.has(name)) {
        problems.push([
          file,
          name,
          `not declared in ${workspace}/package.json`,
        ]);
      }
    }
  }
}

const rel = (f) => path.relative(root, f).replace(/\\/g, "/");

console.log(`workspaces checked: ${WORKSPACES.length}`);
console.log(`undeclared or deep imports: ${problems.length}`);
for (const [file, spec, why] of problems) {
  console.log(`  ${rel(file)} -> ${spec} (${why})`);
}

if (problems.length > 0) {
  console.error(
    "\nDeclare these in the importing workspace's package.json, or import them directly.",
  );
  process.exit(1);
}
