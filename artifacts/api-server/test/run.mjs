// Runs the test suite with Node's built-in runner.
//
// The source uses extensionless relative imports (`./statistics`), which Node's
// ESM resolver cannot resolve, so `node --test` cannot load the TypeScript
// sources directly. esbuild bundles the test entry into a single ESM file,
// which the built-in runner then executes. This keeps the suite dependency-free
// — esbuild is already a devDependency of this package.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const outDir = await mkdtemp(join(tmpdir(), "quantstock-test-"));
  const outfile = join(outDir, "bundle.mjs");

  try {
    await build({
      entryPoints: [join(here, "scoring.test.ts")],
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      outfile,
      logLevel: "warning",
      // node:test and node:assert must stay external so the runner recognises
      // them; bundling them would inline a second copy of the test registry.
      external: ["node:*"],
    });

    const child = spawn(process.execPath, ["--test", outfile], {
      stdio: "inherit",
    });

    const code = await new Promise((resolve) => {
      child.on("close", (exitCode) => resolve(exitCode ?? 1));
    });
    process.exitCode = code;
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
