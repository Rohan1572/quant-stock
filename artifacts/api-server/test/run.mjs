// Runs the test suite with Node's built-in runner.
//
// The source uses extensionless relative imports (`./statistics`), which Node's
// ESM resolver cannot resolve, so `node --test` cannot load the TypeScript
// sources directly. esbuild bundles the test entry into a single ESM file,
// which the built-in runner then executes. This keeps the suite dependency-free
// — esbuild is already a devDependency of this package.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const outDir = await mkdtemp(join(here, ".quantstock-test-"));
  const testFiles = ["scoring.test", "data-fetching.test"].map((name) =>
    join(outDir, `${name}.mjs`),
  );

  try {
    await build({
      entryPoints: [
        join(here, "scoring.test.ts"),
        join(here, "data-fetching.test.ts"),
      ],
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      outdir: outDir,
      outExtension: { ".js": ".mjs" },
      logLevel: "warning",
      // Keep Node built-ins external for the test registry, and Pino external
      // because its Node-specific dynamic loading does not bundle cleanly as ESM.
      external: ["node:*", "pino"],
    });

    const child = spawn(process.execPath, ["--test", ...testFiles], {
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

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
