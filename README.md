# Quant Stock

Quant Stock is a full-stack stock scoring workspace with a React frontend, a Vite-based mockup sandbox, and an Express API server.

## Prerequisites

Make sure you have the following installed locally:

- Node.js 24
- pnpm 11
- PostgreSQL (required for the API/database-backed flows)

If pnpm is not installed yet, enable it with:

```bash
corepack enable
```

## 1. Install dependencies

From the repository root:

```bash
pnpm install
```

This workspace uses pnpm workspaces, so the install step will set up the frontend, API server, shared libraries, and scripts together.

## 2. Configure environment variables

Create a shell environment before starting the API server. A minimal setup looks like this:

```bash
export PORT=5000
export BASE_PATH=/
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quantstock
```

On Windows PowerShell, use:

```powershell
$env:PORT="5000"
$env:BASE_PATH="/"
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quantstock"
```

> The frontend and mockup sandbox can usually run without a database, but the API server expects a valid database connection for the DB-backed routes.

## 3. Run the app locally

### Frontend app

```bash
pnpm --filter @workspace/quantstock run dev
```

### Mockup sandbox

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

### API server

```bash
pnpm --filter @workspace/api-server run dev
```

The API server will listen on the port from the `PORT` environment variable.

## 4. Database setup

If you want to use the DB-backed features, apply the schema after your database is available:

```bash
pnpm --filter @workspace/db run push
```

## 5. Generate API artifacts

If the OpenAPI contract changes, regenerate the client and schema code:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## 6. Typecheck and build

Run the full workspace validation:

```bash
pnpm run typecheck
```

Build everything:

```bash
pnpm run build
```

## Project structure

- `artifacts/api-server/` — Express API server
- `artifacts/quantstock/` — main React/Vite frontend
- `artifacts/mockup-sandbox/` — Vite mockup playground
- `lib/api-spec/` — OpenAPI contract and codegen config
- `lib/api-client-react/` — generated React API client
- `lib/api-zod/` — generated Zod schemas
- `db/` — Drizzle schema and migrations setup
- `scripts/` — workspace helper scripts

## Troubleshooting

- If pnpm reports missing native modules during the install or build, run `pnpm install` again from the repo root.
- If the API server fails before startup, verify that `DATABASE_URL` is set correctly.
- If the Vite dev server does not start as expected, confirm that `PORT` and `BASE_PATH` are set or use the defaults already configured in the Vite files.
