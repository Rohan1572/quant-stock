---
name: Orval path+query param collision
description: TS2308 duplicate export when an OpenAPI operation mixes a path param with a query param, distinct from the known body-naming collision.
---

When a single OpenAPI operation has **both** a path parameter and a query parameter, Orval's zod-client output (`api.ts`) emits `<Op>Params` as the path-params object, while its parallel type output (`generated/types/<op>Params.ts`) emits a type of the *same name* representing the query params instead. Both get re-exported via `export *` in the `api-zod` barrel, producing a TS2308 duplicate-export error after codegen.

Operations with only path params, or only query params, do not collide — only the mixed case does.

**Why:** this is a separate Orval quirk from the documented `<OperationIdPascal>Body` naming collision (see `pnpm-workspace` skill's `openapi.md`) — same failure signature (TS2308), different root cause.

**How to apply:** avoid combining a path param with a query param on the same operation. If an endpoint logically needs both (e.g. `GET /things/{id}/history?range=`), move the extra parameter into the path instead (e.g. `GET /things/{id}/history/{range}`), using an enum path segment if the values are a fixed set.
