import { createRequire } from "node:module";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build as esbuild, context as esbuildContext } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { cp, rm } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

// Shared by both paths so they always compile the same thing.
function buildOptions() {
  return {
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    minify: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "node-pg-migrate",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] }),
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  };
}

const distDir = path.resolve(artifactDir, "dist");
const migrationsDir = path.resolve(artifactDir, "../../lib/db/migrations");

async function copyMigrations() {
  await cp(migrationsDir, path.join(distDir, "migrations"), {
    recursive: true,
  });
}

async function buildAll() {
  await rm(distDir, { recursive: true, force: true });
  const analyze = process.env["ANALYZE_BUNDLE"] === "1";
  const result = await esbuild({
    ...buildOptions(),
    ...(analyze ? { metafile: true } : {}),
  });
  await copyMigrations();
  if (analyze && result.metafile) {
    const bundle = Object.values(result.metafile.outputs).find((output) =>
      output.entryPoint?.endsWith("src/index.ts"),
    );
    if (!bundle) {
      throw new Error("Could not find the API entrypoint in the build output.");
    }

    const inputs = Object.entries(bundle.inputs)
      .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
      .slice(0, 15);
    console.log("Largest API bundle inputs:");
    for (const [input, details] of inputs) {
      const sizeKb = details.bytesInOutput / 1000;
      const percent = (details.bytesInOutput / bundle.bytes) * 100;
      console.log(
        `  ${sizeKb.toFixed(1).padStart(7)} kB  ${percent.toFixed(1).padStart(5)}%  ${input}`,
      );
    }
  }
}

// Restart after each successful rebuild. onEnd skips builds with errors, so a
// syntax error leaves the last working server up.
async function watchAll() {
  let child = null;
  let stopping = false;

  const stop = () => {
    if (child && child.exitCode === null) {
      child.kill();
      child = null;
    }
  };

  const start = () => {
    stop();
    child = spawn(
      process.execPath,
      [
        "--enable-source-maps",
        "--env-file-if-exists=../../.env",
        "./dist/index.mjs",
      ],
      { cwd: artifactDir, stdio: "inherit" },
    );
    child.on("exit", (code, signal) => {
      if (stopping) return;
      if (signal) console.error(`server exited (${signal})`);
      process.exitCode = code ?? 0;
    });
  };

  const restartPlugin = {
    name: "restart-server",
    setup(build) {
      let first = true;
      build.onEnd((result) => {
        if (result.errors.length > 0) return;
        // watch() does the initial build before it resolves; start() covers that.
        if (first) {
          first = false;
          return;
        }
        start();
      });
    },
  };

  const ctx = await esbuildContext({
    ...buildOptions(),
    plugins: [...buildOptions().plugins, restartPlugin],
  });
  await ctx.watch();
  await copyMigrations();
  start();

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      stopping = true;
      stop();
      void ctx.dispose().then(() => process.exit(0));
    });
  }
}

const run = isWatch ? watchAll : buildAll;
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
