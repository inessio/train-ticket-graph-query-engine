import { buildGraph } from "../../src/core/graph/GraphBuilder";
import { fixtureNodes, fixtureEdges } from "../fixtures/graph.fixture";

describe("GraphBuilder", () => {
  it("builds correct adjacency list from fixture", () => {
    const graph = buildGraph({ nodes: fixtureNodes, edges: fixtureEdges });
    expect(graph.adjacencyList.get("frontend")).toEqual(["api"]);
    expect(new Set(graph.adjacencyList.get("api"))).toEqual(
      new Set(["worker", "db"])
    );
    expect(graph.adjacencyList.get("worker")).toEqual(["queue"]);
    expect(graph.adjacencyList.get("db")).toEqual([]);
    expect(graph.adjacencyList.get("queue")).toEqual([]);
  });

  it("nodeMap contains all nodes", () => {
    const graph = buildGraph({ nodes: fixtureNodes, edges: fixtureEdges });
    for (const n of fixtureNodes) {
      expect(graph.nodeMap.get(n.name)?.kind).toBe(n.kind);
    }
  });

  it("handles edges where 'to' is a string (not array)", () => {
    const graph = buildGraph({
      nodes: fixtureNodes,
      edges: [{ from: "frontend", to: "api" }],
    });
    expect(graph.adjacencyList.get("frontend")).toEqual(["api"]);
  });

  it("throws on malformed input (missing required fields)", () => {
    expect(() =>
      // @ts-expect-error intentional malformed input
      buildGraph({ nodes: [{ kind: "service" }], edges: [] })
    ).toThrow(/name/);
    expect(() =>
      // @ts-expect-error intentional malformed input
      buildGraph({ nodes: [{ name: "x" }], edges: [] })
    ).toThrow(/kind/);
  });
});
