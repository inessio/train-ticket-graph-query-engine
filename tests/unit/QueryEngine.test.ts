import { buildGraph } from "../../src/core/graph/GraphBuilder";
import { QueryEngine } from "../../src/core/graph/QueryEngine";
import { SINK_KINDS } from "../../src/core/graph/types";
import { fixtureNodes, fixtureEdges } from "../fixtures/graph.fixture";

describe("QueryEngine", () => {
  const graph = buildGraph({ nodes: fixtureNodes, edges: fixtureEdges });
  const routes = QueryEngine.compute(graph);

  it("returns at least one route for the fixture graph", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it("every route starts and ends at a valid node", () => {
    for (const r of routes) {
      expect(graph.nodeMap.has(r.nodes[0].name)).toBe(true);
      expect(graph.nodeMap.has(r.nodes[r.nodes.length - 1].name)).toBe(true);
    }
  });

  it("no route contains a cycle (no repeated node name)", () => {
    for (const r of routes) {
      const names = r.nodes.map((n) => n.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("sink nodes (rds/sqs) always appear as terminal nodes only", () => {
    for (const r of routes) {
      for (let i = 0; i < r.nodes.length; i += 1) {
        const isLast = i === r.nodes.length - 1;
        if (SINK_KINDS.has(r.nodes[i].kind)) {
          expect(isLast).toBe(true);
        }
      }
    }
  });

  it("meta.endsAtSink true iff last node kind is rds or sqs", () => {
    for (const r of routes) {
      const last = r.nodes[r.nodes.length - 1];
      expect(r.meta.endsAtSink).toBe(SINK_KINDS.has(last.kind));
    }
  });

  it("meta.startsFromPublic reflects publicExposed of first node", () => {
    for (const r of routes) {
      expect(r.meta.startsFromPublic).toBe(r.nodes[0].publicExposed === true);
    }
  });

  it("meta.hasVulnerability true iff any node has vulnerabilities", () => {
    for (const r of routes) {
      const hasAny = r.nodes.some(
        (n) => (n.vulnerabilities?.length ?? 0) > 0
      );
      expect(r.meta.hasVulnerability).toBe(hasAny);
    }
  });
});
