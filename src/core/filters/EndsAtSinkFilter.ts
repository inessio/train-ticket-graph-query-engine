import type { Route } from "../graph/types";
import type { RouteFilter } from "./RouteFilter.interface";

export class EndsAtSinkFilter implements RouteFilter {
  readonly name = "endsAtSink";
  readonly description =
    "Routes that terminate at a sink node (kind rds or sqs).";

  apply(route: Route): boolean {
    return route.meta.endsAtSink;
  }
}
