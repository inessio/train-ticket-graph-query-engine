import path from "path";
import request from "supertest";
import { RouteCache } from "../../src/infrastructure/RouteCache";
import { SINK_KINDS } from "../../src/core/graph/types";

process.env.NODE_ENV = "test";
process.env.DATA_FILE_PATH = path.resolve(__dirname, "../../train-ticket-be.json");
process.env.LOG_LEVEL = "error";

// Import after env is set so config picks up DATA_FILE_PATH.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildApp } = require("../../src/app");

describe("graph routes integration", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    RouteCache.flush();
    const bundle = await buildApp();
    app = bundle.app;
  });

  it("GET /api/v1/health → 200 with uptime and cachedKeys", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.cachedKeys).toBe("number");
  });

  it("GET /api/v1/graph → 200 with nodes[] and edges[]", async () => {
    const res = await request(app).get("/api/v1/graph");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
    expect(res.body.nodes.length).toBeGreaterThan(0);
  });

  it("GET /api/v1/graph/routes (no filters) → 200 with all routes", async () => {
    const res = await request(app).get("/api/v1/graph/routes");
    expect(res.status).toBe(200);
    expect(res.body.meta.totalRoutes).toBeGreaterThan(0);
    expect(res.body.meta.appliedFilters).toEqual([]);
  });

  it("GET /api/v1/graph/routes?filters=startsPublic → first node publicExposed", async () => {
    const res = await request(app).get(
      "/api/v1/graph/routes?filters=startsPublic"
    );
    expect(res.status).toBe(200);
    // Every node in the induced subgraph that is a starting node should be public.
    // Shorthand check: at least one node must be marked publicExposed: true.
    const somePublic = res.body.nodes.some(
      (n: { publicExposed?: boolean }) => n.publicExposed === true
    );
    expect(somePublic).toBe(true);
  });

  it("GET /api/v1/graph/routes?filters=endsAtSink → contains a sink node", async () => {
    const res = await request(app).get(
      "/api/v1/graph/routes?filters=endsAtSink"
    );
    expect(res.status).toBe(200);
    const someSink = res.body.nodes.some(
      (n: { kind: string }) => SINK_KINDS.has(n.kind as "rds" | "sqs" | "service")
    );
    expect(someSink).toBe(true);
  });

  it("GET /api/v1/graph/routes?filters=hasVulnerability → subgraph contains a vuln node", async () => {
    const res = await request(app).get(
      "/api/v1/graph/routes?filters=hasVulnerability"
    );
    expect(res.status).toBe(200);
    const someVuln = res.body.nodes.some(
      (n: { vulnerabilities?: unknown[] }) =>
        Array.isArray(n.vulnerabilities) && n.vulnerabilities.length > 0
    );
    expect(someVuln).toBe(true);
  });

  it("GET /api/v1/graph/routes?filters=startsPublic,endsAtSink&operator=AND", async () => {
    const res = await request(app).get(
      "/api/v1/graph/routes?filters=startsPublic,endsAtSink&operator=AND"
    );
    expect(res.status).toBe(200);
    expect(res.body.meta.operator).toBe("AND");
  });

  it("GET /api/v1/graph/routes?filters=startsPublic,endsAtSink&operator=OR", async () => {
    const res = await request(app).get(
      "/api/v1/graph/routes?filters=startsPublic,endsAtSink&operator=OR"
    );
    expect(res.status).toBe(200);
    expect(res.body.meta.operator).toBe("OR");
  });

  it("GET /api/v1/graph/routes?filters=unknown → 400 with error.code", async () => {
    const res = await request(app).get(
      "/api/v1/graph/routes?filters=unknown"
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNKNOWN_FILTER");
  });

  it("GET /api/v1/graph/nodes/auth-service → 200 with node + neighbours", async () => {
    const res = await request(app).get("/api/v1/graph/nodes/auth-service");
    expect(res.status).toBe(200);
    expect(res.body.node.name).toBe("auth-service");
    expect(Array.isArray(res.body.neighbours)).toBe(true);
    const names = res.body.neighbours.map((n: { name: string }) => n.name);
    expect(new Set(names)).toEqual(
      new Set(["verification-code-service", "prod-postgresdb"])
    );
  });

  it("GET /api/v1/graph/nodes/nonexistent → 404", async () => {
    const res = await request(app).get("/api/v1/graph/nodes/nope");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NODE_NOT_FOUND");
  });
});
