import { logger } from "../../logger/logger";
import {
  Graph,
  GraphNode,
  Route,
  RouteMeta,
  Edge,
  SINK_KINDS,
  maxSeverity,
  Severity,
} from "./types";

interface StackFrame {
  nodeName: string;
  pathNames: string[];
  visited: Set<string>;
}

function routeMetaFor(nodes: GraphNode[]): RouteMeta {
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  let severity: Severity | null = null;
  let hasVuln = false;
  for (const n of nodes) {
    if (n.vulnerabilities && n.vulnerabilities.length > 0) {
      hasVuln = true;
      for (const v of n.vulnerabilities) severity = maxSeverity(severity, v.severity);
    }
  }
  return {
    startsFromPublic: first.publicExposed === true,
    endsAtSink: SINK_KINDS.has(last.kind),
    hasVulnerability: hasVuln,
    maxSeverity: severity,
    length: nodes.length,
  };
}

function edgesFor(nodes: GraphNode[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({ from: nodes[i].name, to: nodes[i + 1].name });
  }
  return edges;
}

export const QueryEngine = {
  compute(graph: Graph): Route[] {
    const routes: Route[] = [];
    const { nodeMap, adjacencyList } = graph;

    for (const startName of nodeMap.keys()) {
      const stack: StackFrame[] = [
        {
          nodeName: startName,
          pathNames: [startName],
          visited: new Set<string>([startName]),
        },
      ];

      while (stack.length > 0) {
        const frame = stack.pop();
        if (!frame) break;
        const current = nodeMap.get(frame.nodeName);
        if (!current) continue;

        const neighbours = adjacencyList.get(frame.nodeName) ?? [];
        const isSink = SINK_KINDS.has(current.kind);
        const extensible = neighbours.filter((n) => !frame.visited.has(n));

        const shouldTerminate =
          isSink || neighbours.length === 0 || extensible.length === 0;

        if (shouldTerminate) {
          if (frame.pathNames.length >= 2) {
            const nodes = frame.pathNames.map((n) => {
              const node = nodeMap.get(n);
              if (!node) throw new Error(`Unknown node '${n}' during route build`);
              return node;
            });
            routes.push({
              nodes,
              edges: edgesFor(nodes),
              meta: routeMetaFor(nodes),
            });
            logger.debug("Route discovered", {
              start: nodes[0].name,
              end: nodes[nodes.length - 1].name,
              length: nodes.length,
            });
          }
          continue;
        }

        for (const next of extensible) {
          const nextVisited = new Set<string>(frame.visited);
          nextVisited.add(next);
          stack.push({
            nodeName: next,
            pathNames: [...frame.pathNames, next],
            visited: nextVisited,
          });
        }
      }
    }

    logger.info("QueryEngine computed routes", { count: routes.length });
    return routes;
  },
} as const;
