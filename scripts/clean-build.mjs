/**
 * Removes build output: every workspace's dist/ and TypeScript build-info files.
 *
 * dist/ and the .tsbuildinfo files must go together. tsc --build trusts the
 * build-info to decide what still needs emitting, so leaving one behind while
 * deleting the other makes it skip the rebuild and leave project references
 * pointing at .d.ts files that no longer exist — which surfaces as dozens of
 * phantom TS6305/TS7006 errors in files nobody touched. Both naming conventions
 * are removed because packages configure tsBuildInfoFile differently:
 * ".tsbuildinfo" (explicit) and "tsconfig.tsbuildinfo" (TypeScript default).
 *
 * Workspaces are read from the root package.json rather than listed here, so a
 * new one cannot be silently omitted.
 *
 * Run with `npm run clean`.
 */
import fs from "node:fs";
import path from "node:path";
import { root, workspaces } from "./workspaces.mjs";

const ARTIFACTS = ["dist", ".tsbuildinfo", "tsconfig.tsbuildinfo"];

let removed = 0;
for (const dir of workspaces()) {
  for (const name of ARTIFACTS) {
    const target = path.join(dir, name);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`removed ${path.relative(root, target) || "."}`);
    removed++;
  }
}

console.log(removed === 0 ? "nothing to remove" : `${removed} removed`);
