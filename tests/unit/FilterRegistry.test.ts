import { buildGraph } from "../../src/core/graph/GraphBuilder";
import { QueryEngine } from "../../src/core/graph/QueryEngine";
import { FilterRegistry } from "../../src/core/filters/FilterRegistry";
import { StartsFromPublicFilter } from "../../src/core/filters/StartsFromPublicFilter";
import { EndsAtSinkFilter } from "../../src/core/filters/EndsAtSinkFilter";
import { HasVulnerabilityFilter } from "../../src/core/filters/HasVulnerabilityFilter";
import { RouteCache } from "../../src/infrastructure/RouteCache";
import { AppError } from "../../src/api/middleware/AppError";
import { SINK_KINDS } from "../../src/core/graph/types";
import { fixtureNodes, fixtureEdges } from "../fixtures/graph.fixture";

describe("FilterRegistry", () => {
  const graph = buildGraph({ nodes: fixtureNodes, edges: fixtureEdges });
  const routes = QueryEngine.compute(graph);

  let registry: FilterRegistry;
  beforeEach(() => {
    RouteCache.flush();
    registry = new FilterRegistry();
    registry.register(new StartsFromPublicFilter());
    registry.register(new EndsAtSinkFilter());
    registry.register(new HasVulnerabilityFilter());
  });

  it("register + get a filter by name", () => {
    expect(registry.get("startsPublic").name).toBe("startsPublic");
  });

  it("getAll returns all registered filters", () => {
    const names = registry.getAll().map((f) => f.name);
    expect(new Set(names)).toEqual(
      new Set(["startsPublic", "endsAtSink", "hasVulnerability"])
    );
  });

  it("get throws AppError for unknown filter name", () => {
    try {
      registry.get("nope");
      fail("expected AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });

  it("applyFilters AND — route must pass ALL filters", () => {
    const out = registry.applyFilters(
      routes,
      graph,
      ["startsPublic", "endsAtSink"],
      "AND"
    );
    for (const r of out) {
      expect(r.meta.startsFromPublic).toBe(true);
      expect(r.meta.endsAtSink).toBe(true);
    }
  });

  it("applyFilters OR — route must pass ANY filter", () => {
    const out = registry.applyFilters(
      routes,
      graph,
      ["startsPublic", "hasVulnerability"],
      "OR"
    );
    for (const r of out) {
      expect(
        r.meta.startsFromPublic || r.meta.hasVulnerability
      ).toBe(true);
    }
  });

  it("applyFilters stores result in RouteCache on first call", () => {
    const before = RouteCache.size();
    registry.applyFilters(routes, graph, ["startsPublic"], "AND");
    expect(RouteCache.size()).toBe(before + 1);
  });

  it("applyFilters returns cached result on second call (no recompute)", () => {
    const first = registry.applyFilters(routes, graph, ["startsPublic"], "AND");
    const second = registry.applyFilters(routes, graph, ["startsPublic"], "AND");
    expect(second).toBe(first);
  });

  it("StartsFromPublicFilter only returns routes from public nodes", () => {
    const out = registry.applyFilters(routes, graph, ["startsPublic"], "AND");
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) expect(r.nodes[0].publicExposed).toBe(true);
  });

  it("EndsAtSinkFilter only returns routes ending at rds or sqs", () => {
    const out = registry.applyFilters(routes, graph, ["endsAtSink"], "AND");
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) {
      const last = r.nodes[r.nodes.length - 1];
      expect(SINK_KINDS.has(last.kind)).toBe(true);
    }
  });

  it("HasVulnerabilityFilter only returns routes containing vuln nodes", () => {
    const out = registry.applyFilters(
      routes,
      graph,
      ["hasVulnerability"],
      "AND"
    );
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) {
      expect(r.nodes.some((n) => (n.vulnerabilities?.length ?? 0) > 0)).toBe(true);
    }
  });
});
