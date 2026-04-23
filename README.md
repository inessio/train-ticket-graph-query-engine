# Train Ticket Graph Query Engine

A production-ready REST API that loads the Train Ticket microservice graph from a single JSON file and exposes filtered, graph-shaped views of the routes through it. The graph is static — loaded once at startup — so every query is served from an in-memory `Map` with no external cache.

## Architecture

Four concentric layers, each depending only on layers below it.

- **Config + Logger** (`src/config/`, `src/logger/`) — Zod-validated environment at boot, a shared Winston logger used everywhere. No `console.log` anywhere in the codebase.
- **Infrastructure** (`src/infrastructure/`) — `DataLoader` reads and Zod-validates the JSON (normalising both `to: string` and `to: string[]` edge shapes, dropping edges that reference undeclared nodes). `RouteCache` is a module-level `Map<string, Route[]>` — the only thing that holds route state at runtime.
- **Core** (`src/core/`) — `GraphBuilder` produces an adjacency list from the parsed data; `QueryEngine` runs an iterative depth-first search from every node with per-branch cycle detection, terminating at sinks (`kind: rds | sqs`). All `Route.meta` booleans are pre-computed during traversal. `FilterRegistry` holds a plug-in set of `RouteFilter`s.
- **API** (`src/api/`) — Thin Express surface: middleware (request logging, query validation, error handling with a typed `AppError`), DTOs, and route handlers that compose the core modules.

### Request lifecycle

```
  HTTP Request
      ↓
  Middleware (logger, validator)
      ↓
  Route Handler
      ↓
  FilterRegistry.applyFilters()
      ↓
  RouteCache.get(key) ──hit──→ return cached response
      ↓ miss
  Filter computation
      ↓
  RouteCache.set(key, result)
      ↓
  Return response
```

### Filter system

A filter implements this interface:

```ts
interface RouteFilter {
  readonly name: string;
  readonly description: string;
  apply(route: Route, graph: Graph): boolean;
}
```

`FilterRegistry.applyFilters(routes, graph, names, operator)` looks up each requested filter by name, composes them with `AND` or `OR`, and caches the result under a key built from the sorted filter names + operator (e.g. `endsAtSink,startsPublic:AND`). The registry is the only entry point to filter evaluation — handlers never call filters directly.

**Adding a new filter is exactly 2 steps**:

1. Create `src/core/filters/MyFilter.ts` that implements `RouteFilter`.
2. Call `registry.register(new MyFilter())` inside `buildApp()` in `src/app.ts`.

Nothing else changes — not the registry, not the routes, not the cache, not the query DTO.

### Caching strategy

The graph is immutable at runtime, so an in-memory `Map` is strictly better than any network cache (Redis etc.): zero round-trip, zero failure modes, perfectly consistent.

- `RouteCache.prime(routes)` is called once at startup under key `"all"`.
- Each filter combination writes its own key `"{sortedNames}:{AND|OR}"` on first evaluation.
- The cache never evicts — the key space is bounded by the small number of filter combinations.
- `Cache-Control: public, max-age=300` is set on `/graph/routes` so clients can also cache for five minutes.

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (optional, for container runs)

## Getting started — local

```bash
git clone <repo> && cd <repo>
cp .env.example .env
npm install
npm run dev
```

The service is at `http://localhost:3000/api/v1`.

## Getting started — Docker

```bash
# Production image:
docker compose -f docker/docker-compose.yml up --build

# Development with hot reload (mounts src/):
docker compose -f docker/docker-compose.yml \
               -f docker/docker-compose.override.yml up
```

## Running tests

```bash
npm test                  # all tests
npm run test:unit         # unit only
npm run test:integration  # integration only (runs against real train-ticket-be.json)
npm run test:coverage     # with coverage report
```

## API reference

### `GET /api/v1/health`

Returns the liveness payload.

```bash
curl http://localhost:3000/api/v1/health
```
```json
{ "status": "ok", "uptime": 12.34, "cachedKeys": 1 }
```

### `GET /api/v1/graph`

The full unfiltered graph.

```bash
curl http://localhost:3000/api/v1/graph
```
```json
{ "nodes": [ ... ], "edges": [ { "from": "frontend", "to": "gateway-service" }, ... ] }
```

### `GET /api/v1/graph/routes`

The induced subgraph (de-duplicated nodes + edges) of every route that passes the requested filters.

| Param      | Type                                              | Default | Description                                                    |
| ---------- | ------------------------------------------------- | ------- | -------------------------------------------------------------- |
| `filters`  | CSV of filter names                               | none    | e.g. `startsPublic,endsAtSink`                                 |
| `operator` | `AND` \| `OR`                                     | `AND`   | How multiple filters combine.                                  |
| `severity` | `high` \| `medium` \| `low`                       | none    | Minimum severity — keeps routes whose `maxSeverity ≥` the arg. |

Response header: `Cache-Control: public, max-age=300`.

```bash
curl "http://localhost:3000/api/v1/graph/routes?filters=startsPublic,endsAtSink&operator=AND"
```
```json
{
  "nodes": [ ... ],
  "edges": [ ... ],
  "meta": {
    "totalRoutes": 7,
    "appliedFilters": ["startsPublic", "endsAtSink"],
    "operator": "AND"
  }
}
```

### `GET /api/v1/graph/nodes/:name`

A single node plus its outbound neighbours.

```bash
curl http://localhost:3000/api/v1/graph/nodes/auth-service
```
```json
{
  "node": { "name": "auth-service", "kind": "service", ... },
  "neighbours": [
    { "name": "verification-code-service", "kind": "service", ... },
    { "name": "prod-postgresdb", "kind": "rds", ... }
  ]
}
```

### `GET /api/v1/filters`

Lists every registered filter.

```bash
curl http://localhost:3000/api/v1/filters
```
```json
[
  { "name": "startsPublic",     "description": "..." },
  { "name": "endsAtSink",       "description": "..." },
  { "name": "hasVulnerability", "description": "..." }
]
```

### Error shape

Every error response has the same body: `{ "error": string, "code": string, "details"?: unknown }`.

| Status | Code             | When                                             |
| ------ | ---------------- | ------------------------------------------------ |
| 400    | `BAD_REQUEST`    | Malformed query params.                          |
| 400    | `UNKNOWN_FILTER` | Unknown filter name requested.                   |
| 404    | `NOT_FOUND`      | Unknown path.                                    |
| 404    | `NODE_NOT_FOUND` | `GET /graph/nodes/:name` for a missing node.     |
| 500    | `INTERNAL_ERROR` | Unhandled error.                                 |

## Rendering the response in a UI

The `/graph` and `/graph/routes` responses are already node-link shaped (`nodes[]`, `edges[]`, `meta`), so they map directly onto any graph visualization library with no transformation step.

### Library choice

- **[React Flow](https://reactflow.dev/)** (recommended) — interactive, React-native, easy to customise node appearance. Needs `dagre` or `elk` added on top for automatic hierarchical layout.
- **[Cytoscape.js](https://js.cytoscape.org/)** — more built-in layouts and graph algorithms, but heavier API and not as ergonomic in React.

Either works against the current response shape. The trade-off is layout-out-of-the-box (Cytoscape) vs. styling-out-of-the-box (React Flow).

### Visual encoding

| Field                     | Suggested visual                                                         |
| ------------------------- | ------------------------------------------------------------------------ |
| `node.kind === "service"` | Rounded rectangle.                                                       |
| `node.kind === "rds"`     | Cylinder icon.                                                           |
| `node.kind === "sqs"`     | Parallelogram / queue icon.                                              |
| `node.publicExposed`      | Green outline to mark public-facing ingress points.                      |
| `node.vulnerabilities`    | Red badge on the node; tooltip lists CWE + severity.                     |
| `edges`                   | Directed arrows — the graph is a DAG so direction matters for blast radius. |

### Filter toolbar

Populate the toolbar from `GET /api/v1/filters` so new filters added server-side show up automatically:

- Checkbox per filter (`name` + `description`).
- `AND` / `OR` toggle → `operator` query param.
- `severity` dropdown (`high` / `medium` / `low`) → `severity` query param.
- Push the active selection into the URL query string so views are shareable.

### Meta side-panel

Show `meta.totalRoutes`, `meta.appliedFilters`, and `meta.operator` alongside the graph. This context is critical because the returned subgraph is *induced from matching routes* rather than being the whole graph — users need to see "why am I only looking at 12 nodes right now."

### Empty-state matters

On the bundled dataset, `?filters=startsPublic,endsAtSink&operator=AND` legitimately returns **0 routes** — no public-exposed service has a downstream path reaching `prod-postgresdb` or `prod-sqs`. A "0 routes match" message with a one-click "relax to OR" action prevents confusion about whether the UI is broken.

### Structural note for future work

The response is deliberately a **de-duplicated induced subgraph**, which is ideal for "show me the blast radius of these filters." If a use case emerges for "walk me through each of the N matching paths individually," the response DTO would need to gain a `routes[]` array (each entry carrying its own ordered node/edge sequence and pre-computed meta). That is an additive change — `nodes[]` / `edges[]` / `meta` can stay as they are.

## Adding a new filter

**Step 1** — create `src/core/filters/MyFilter.ts`:

```ts
import type { RouteFilter } from "./RouteFilter.interface";
import type { Route } from "../graph/types";

export class MyFilter implements RouteFilter {
  readonly name = "myFilter";
  readonly description = "What it matches.";
  apply(route: Route): boolean { /* return true to keep */ return true; }
}
```

**Step 2** — register it in `src/app.ts`:

```ts
registry.register(new MyFilter());
```

Nothing else changes — the filter becomes queryable as `?filters=myFilter` and shows up in `GET /api/v1/filters`.

## Environment variables

| Variable         | Required | Default | Description                                        |
| ---------------- | -------- | ------- | -------------------------------------------------- |
| `PORT`           | no       | `3000`  | HTTP port.                                         |
| `NODE_ENV`       | no       | `development` | `development` \| `production` \| `test`.     |
| `DATA_FILE_PATH` | **yes**  | —       | Absolute or relative path to the graph JSON file.  |
| `LOG_LEVEL`      | no       | `info`  | Winston log level (`debug`, `info`, `warn`, ...).  |

## Assumptions & design decisions

- **Dangling edges** (`assurance-service` is referenced from `preserve-service` / `preserve-other-service` but not declared in `nodes[]`): `DataLoader` drops those edges and emits a `warn` log line. The alternative — failing startup — would make the bundled dataset unrunnable.
- **`severity` query param** is a post-filter on `Route.meta.maxSeverity`, implemented as a minimum-severity gate rather than an equality check. This keeps the filter registry free of parameterised entries while still supporting `?severity=high` to surface the most serious routes.
- **Routes** means paths through the DAG, not single edges. Depth is bounded implicitly by the cycle-detection `Set<string>` maintained per DFS branch.
- **No persistence beyond the JSON file**: caching is a native `Map` only, per the non-negotiable constraints.
