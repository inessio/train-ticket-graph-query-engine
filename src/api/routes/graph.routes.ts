import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/AppError";
import { validateQuery } from "../middleware/validateQuery";
import { RouteCache } from "../../infrastructure/RouteCache";
import {
  GraphRoutesQuerySchema,
  GraphRoutesQuery,
} from "../dto/graphQuery.dto";
import {
  GraphResponseDto,
  GraphRoutesResponseDto,
  HealthResponseDto,
  NodeDetailResponseDto,
} from "../dto/graphResponse.dto";
import {
  Graph,
  Route,
  Severity,
  Edge,
  GraphNode,
  SEVERITY_RANK,
} from "../../core/graph/types";
import {
  FilterOperator,
  FilterRegistry,
} from "../../core/filters/FilterRegistry";

export interface GraphRouterDeps {
  graph: Graph;
  allRoutes: Route[];
  registry: FilterRegistry;
}

function inducedSubgraph(routes: Route[]): {
  nodes: GraphNode[];
  edges: Edge[];
} {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, Edge>();
  for (const route of routes) {
    for (const n of route.nodes) nodes.set(n.name, n);
    for (const e of route.edges) edges.set(`${e.from}->${e.to}`, e);
  }
  return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) };
}

function filterBySeverity(routes: Route[], minimum: Severity): Route[] {
  const min = SEVERITY_RANK[minimum];
  return routes.filter((r) => {
    if (r.meta.maxSeverity === null) return false;
    return SEVERITY_RANK[r.meta.maxSeverity] >= min;
  });
}

export function createGraphRouter(deps: GraphRouterDeps): Router {
  const router = Router();
  const { graph, allRoutes, registry } = deps;

  router.get("/health", (_req: Request, res: Response) => {
    const body: HealthResponseDto = {
      status: "ok",
      uptime: process.uptime(),
      cachedKeys: RouteCache.size(),
    };
    res.status(200).json(body);
  });

  router.get("/graph", (_req: Request, res: Response) => {
    const nodes = Array.from(graph.nodeMap.values());
    const edges: Edge[] = [];
    for (const [from, tos] of graph.adjacencyList.entries()) {
      for (const to of tos) edges.push({ from, to });
    }
    const body: GraphResponseDto = { nodes, edges };
    res.status(200).json(body);
  });

  router.get(
    "/graph/routes",
    validateQuery(GraphRoutesQuerySchema),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = req.validatedQuery as GraphRoutesQuery;
        const operator: FilterOperator = query.operator;

        let matched = registry.applyFilters(
          allRoutes,
          graph,
          query.filters,
          operator
        );

        if (query.severity) {
          matched = filterBySeverity(matched, query.severity);
        }

        const { nodes, edges } = inducedSubgraph(matched);
        const body: GraphRoutesResponseDto = {
          nodes,
          edges,
          meta: {
            totalRoutes: matched.length,
            appliedFilters: query.filters,
            operator,
          },
        };
        res.set("Cache-Control", "public, max-age=300");
        res.status(200).json(body);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get("/graph/nodes/:name", (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = req.params.name;
      const node = graph.nodeMap.get(name);
      if (!node) {
        throw new AppError(404, "NODE_NOT_FOUND", `Node '${name}' not found`);
      }
      const neighbourNames = graph.adjacencyList.get(name) ?? [];
      const neighbours = neighbourNames
        .map((n) => graph.nodeMap.get(n))
        .filter((n): n is GraphNode => n !== undefined);
      const body: NodeDetailResponseDto = { node, neighbours };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
