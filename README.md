# Quant Stock

Quant Stock is a full-stack stock scoring workspace with a React frontend, a Vite-based mockup sandbox, and an Express API server.

## Prerequisites

Make sure you have the following installed locally:

- Node.js 24
- PostgreSQL (required for the API/database-backed flows)

## 1. Install dependencies

From the repository root:

```powershell
npm install
```

This repository uses npm workspaces for the frontend, API server, and shared libraries. Repository tooling lives in `scripts/`. If you need a clean reinstall, run `npm run reinstall`.

## 2. Configure environment variables

In PowerShell, set the API environment variables before starting the server:

```powershell
$env:PORT="5000"
$env:BASE_PATH="/"
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quantstock"
```

> The frontend and mockup sandbox can usually run without a database, but the API server expects a valid database connection for the DB-backed routes.

## 3. Database setup

Create the `quantstock` PostgreSQL database before starting the API server. The API bootstraps the required migration state automatically on first connect, and the explicit migration command is still available from the repository root:

```powershell
npm run db:migrate
```

## 4. Run the app locally

Start the API server first in a separate PowerShell terminal. Set the variables from step 2, then run:

```powershell
npm run dev:api
```

The API server watches its sources and the libraries it bundles, recompiling and restarting on save. A build error is reported but leaves the last working server running. It listens on `http://localhost:5000`; the frontend dev server proxies `/api` to it.

### Frontend app

```powershell
$env:PORT="3000"
$env:BASE_PATH="/"
npm run dev
```

Open `http://localhost:3000`.

### Mockup sandbox

```powershell
$env:PORT="3001"
npm run dev:mockup
```

Open `http://localhost:3001`.

## 5. Generate API artifacts

If the OpenAPI contract changes, regenerate the client and schema code:

```powershell
npm run codegen
```

## 6. Typecheck, test, lint and build

Run the full workspace validation:

```powershell
npm run typecheck
```

Run the scoring engine test suite:

```powershell
npm run test
```

Run ESLint with the recommended JavaScript, TypeScript, HTML, and SonarJS rules:

```powershell
npm run lint
```

Git commit messages are checked by Husky and must use Conventional Commits, for example `feat(api): add company search`.

Apply the fixes ESLint can make automatically:

```powershell
npm run lint:fix
```

Check or apply formatting (Prettier; generated code is ignored):

```powershell
npm run format:check
npm run format
```

Check that every workspace declares what it imports:

```powershell
npm run audit:deps
```

Check for new dependency vulnerabilities:

```powershell
npm audit
```

This fails when npm reports dependency vulnerabilities.

It replaced `fast-glob` in the mockup sandbox, which was the only route to a
high-severity `braces` stack-exhaustion advisory (CVE-2026-93687) with no
patched release — `node:fs`'s built-in glob does the same job and removed
`fast-glob`, `micromatch` and `braces` from the tree entirely.

Build everything:

```powershell
npm run build
```

The API bundle is minified by default, with linked source maps retained. To
inspect which inputs contribute to it, run the build with `ANALYZE_BUNDLE=1`
set. In PowerShell:

```powershell
$env:ANALYZE_BUNDLE="1"
npm run --workspace=@workspace/api-server build
Remove-Item Env:ANALYZE_BUNDLE
```

Run every CI check in one go, in the same order CI uses:

```powershell
npm run verify
```

Discard all build output. `dist/` and the `.tsbuildinfo` files must go together —
leaving the latter makes `tsc --build` trust stale state and skip emitting:

```powershell
npm run clean
```

## Continuous integration

`.github/workflows/ci.yml` runs the dependency audit, typecheck, tests, lint,
format check and build on every push to `main` and on every pull request, so the
checks above are enforced rather than left to habit. A second job applies the
migrations up, down and up again against a real Postgres.

Changes that touch the API contract must run `npm run codegen` and commit the
generated output.

### Dependency updates

`package-lock.json` is intentionally not tracked. Dependencies are reviewed and
bumped deliberately — typically once a week, or in response to an advisory —
rather than drifting in from upstream between commits.

The trade-off is that CI resolves the current tree on every run instead of a
pinned one, so a new transitive release can break a build that passed an hour
earlier. That is the accepted cost of reviewing upgrades in one place instead of
reviewing them in a diff nobody reads. If a build fails right after a green run,
check whether an upstream package moved before suspecting the code.

## Project structure

- `artifacts/api-server/` — Express API server (scoring engine + test suite)
- `artifacts/quantstock/` — main React/Vite frontend
- `artifacts/mockup-sandbox/` — Vite mockup playground
- `docs/` — scoring model notes and data-source caveats
- `lib/api-spec/` — OpenAPI contract and codegen config
- `lib/api-client-react/` — generated React API client
- `lib/api-zod/` — generated Zod schemas
- `lib/db/` — Drizzle schema and migrations setup
- `scripts/` — repository tooling for dependency checks, clean builds, and reinstalls

## Scoring model

The score is a weighted blend of six categories, each scored against sector
benchmarks. Read `docs/scoring-model.md` before changing it — it covers the
invariants that are easy to break, and the caveats in the upstream data feed
that have already caused wrong results.

## Troubleshooting

- If npm reports missing native modules during the install or build, run `npm run reinstall` from the repo root.
- If the API server fails before startup, verify that `DATABASE_URL` is set correctly.
- If the Vite dev server does not start as expected, confirm that `PORT` and `BASE_PATH` are set or use the defaults already configured in the Vite files.
- If the dev server returns "Blocked request" — or won't load from another device on the LAN — the hostname isn't in the Host allowlist. Add it to `VITE_ALLOWED_HOSTS` in `.env`.
- If the frontend can't reach `/api`, keep `API_PORT` (default `5000`) in step with the API's `PORT`.
- If the browser blocks an API response, the origin isn't in the CORS allowlist. Add it to `CORS_ORIGINS` in `.env`.
