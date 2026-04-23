import { logger } from "../../logger/logger";
import type { Edge, Graph, GraphNode } from "./types";

type RawEdge = { from: string; to: string | string[] };

export interface RawGraphInput {
  nodes: GraphNode[];
  edges: Array<Edge | RawEdge>;
}

function normalizeEdges(edges: Array<Edge | RawEdge>): Edge[] {
  const result: Edge[] = [];
  for (const e of edges) {
    if (Array.isArray(e.to)) {
      for (const to of e.to) result.push({ from: e.from, to });
    } else {
      result.push({ from: e.from, to: e.to });
    }
  }
  return result;
}

export function buildGraph(input: RawGraphInput): Graph {
  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    throw new Error("GraphBuilder: input must contain nodes[] and edges[]");
  }

  const nodeMap = new Map<string, GraphNode>();
  for (const node of input.nodes) {
    if (!node.name) throw new Error("GraphBuilder: node missing 'name'");
    if (!node.kind) throw new Error("GraphBuilder: node missing 'kind'");
    if (nodeMap.has(node.name)) {
      throw new Error(`GraphBuilder: duplicate node name '${node.name}'`);
    }
    nodeMap.set(node.name, node);
  }

  const adjacencyList = new Map<string, string[]>();
  for (const name of nodeMap.keys()) adjacencyList.set(name, []);

  const normalized = normalizeEdges(input.edges);
  for (const edge of normalized) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      // DataLoader normally drops these; if any slipped through, skip them here too.
      continue;
    }
    const neighbours = adjacencyList.get(edge.from);
    if (neighbours && !neighbours.includes(edge.to)) neighbours.push(edge.to);
  }

  logger.info("Graph built", {
    nodes: nodeMap.size,
    edges: normalized.length,
  });

  return { nodeMap, adjacencyList };
}
