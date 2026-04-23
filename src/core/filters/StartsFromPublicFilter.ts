import type { Route } from "../graph/types";
import type { RouteFilter } from "./RouteFilter.interface";

export class StartsFromPublicFilter implements RouteFilter {
  readonly name = "startsPublic";
  readonly description =
    "Routes whose source node is public-facing (publicExposed: true).";

  apply(route: Route): boolean {
    return route.meta.startsFromPublic;
  }
}
