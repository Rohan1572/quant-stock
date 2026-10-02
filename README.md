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

This repository uses npm workspaces, so the install step sets up the frontend, API server, shared libraries, and scripts together. If you need a clean reinstall, run `npm run reinstall`.

## 2. Configure environment variables

In PowerShell, set the API environment variables before starting the server:

```powershell
$env:PORT="5000"
$env:BASE_PATH="/"
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quantstock"
```

> The frontend and mockup sandbox can usually run without a database, but the API server expects a valid database connection for the DB-backed routes.

## 3. Database setup

Create the `quantstock` PostgreSQL database before starting the API server. Database migration commands are available from the database workspace:

```powershell
npm run --workspace=@workspace/db migrate
```

## 4. Run the app locally

Start the API server first in a separate PowerShell terminal. Set the variables from step 2, then run:

```powershell
npm run dev:api
```

The API server listens on `http://localhost:5000`. The frontend development server proxies `/api` requests to it.

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

Run the SonarJS quality rules (the same analyzer SonarQube applies to JS/TS,
without needing a server):

```powershell
npm run lint
```

Check or apply formatting (Prettier; generated code is ignored):

```powershell
npm run format:check
npm run format
```

Build everything:

```powershell
npm run build
```

## Project structure

- `artifacts/api-server/` — Express API server (scoring engine + test suite)
- `artifacts/quantstock/` — main React/Vite frontend
- `artifacts/mockup-sandbox/` — Vite mockup playground
- `docs/` — scoring model notes and data-source caveats
- `lib/api-spec/` — OpenAPI contract and codegen config
- `lib/api-client-react/` — generated React API client
- `lib/api-zod/` — generated Zod schemas
- `lib/db/` — Drizzle schema and migrations setup
- `scripts/` — workspace helper scripts

## Scoring model

The score is a weighted blend of six categories, each scored against sector
benchmarks. Read `docs/scoring-model.md` before changing it — it covers the
invariants that are easy to break, and the caveats in the upstream data feed
that have already caused wrong results.

## Troubleshooting

- If npm reports missing native modules during the install or build, run `npm run reinstall` from the repo root.
- If the API server fails before startup, verify that `DATABASE_URL` is set correctly.
- If the Vite dev server does not start as expected, confirm that `PORT` and `BASE_PATH` are set or use the defaults already configured in the Vite files.
