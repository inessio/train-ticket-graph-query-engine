import path from "path";
import request from "supertest";
import { RouteCache } from "../../src/infrastructure/RouteCache";

process.env.NODE_ENV = "test";
process.env.DATA_FILE_PATH = path.resolve(__dirname, "../../train-ticket-be.json");
process.env.LOG_LEVEL = "error";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildApp } = require("../../src/app");

describe("filter routes integration", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    RouteCache.flush();
    const bundle = await buildApp();
    app = bundle.app;
  });

  it("GET /api/v1/filters → 200 with array of { name, description }", async () => {
    const res = await request(app).get("/api/v1/filters");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const f of res.body) {
      expect(typeof f.name).toBe("string");
      expect(typeof f.description).toBe("string");
    }
  });

  it("response contains startsPublic, endsAtSink, hasVulnerability entries", async () => {
    const res = await request(app).get("/api/v1/filters");
    const names = new Set(res.body.map((f: { name: string }) => f.name));
    expect(names.has("startsPublic")).toBe(true);
    expect(names.has("endsAtSink")).toBe(true);
    expect(names.has("hasVulnerability")).toBe(true);
  });
});
