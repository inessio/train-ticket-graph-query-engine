import type { Graph, Route } from "../graph/types";

export interface RouteFilter {
  readonly name: string;
  readonly description: string;
  apply(route: Route, graph: Graph): boolean;
}
