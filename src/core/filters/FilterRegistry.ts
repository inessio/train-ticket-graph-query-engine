import { logger } from "../../logger/logger";
import { RouteCache } from "../../infrastructure/RouteCache";
import { AppError } from "../../api/middleware/AppError";
import type { Graph, Route } from "../graph/types";
import type { RouteFilter } from "./RouteFilter.interface";

export type FilterOperator = "AND" | "OR";

export class FilterRegistry {
  private readonly filters: Map<string, RouteFilter> = new Map();

  register(filter: RouteFilter): void {
    this.filters.set(filter.name, filter);
    logger.info("Filter registered", {
      name: filter.name,
      description: filter.description,
    });
  }

  get(name: string): RouteFilter {
    const filter = this.filters.get(name);
    if (!filter) {
      logger.warn("Unknown filter requested", { name });
      throw new AppError(400, "UNKNOWN_FILTER", `Unknown filter '${name}'`);
    }
    return filter;
  }

  getAll(): RouteFilter[] {
    return Array.from(this.filters.values());
  }

  applyFilters(
    routes: Route[],
    graph: Graph,
    filterNames: string[],
    operator: FilterOperator
  ): Route[] {
    if (filterNames.length === 0) return routes;

    const filters = filterNames.map((n) => this.get(n));
    const cacheKey = this.buildKey(filterNames, operator);

    const cached = RouteCache.get(cacheKey);
    if (cached) {
      logger.info("Filter result served from cache", {
        key: cacheKey,
        count: cached.length,
      });
      return cached;
    }

    const matcher =
      operator === "AND"
        ? (r: Route) => filters.every((f) => f.apply(r, graph))
        : (r: Route) => filters.some((f) => f.apply(r, graph));

    const result = routes.filter(matcher);
    RouteCache.set(cacheKey, result);

    logger.info("Filters applied", {
      filters: filterNames,
      operator,
      matched: result.length,
      total: routes.length,
    });

    return result;
  }

  private buildKey(filterNames: string[], operator: FilterOperator): string {
    const sorted = [...filterNames].sort().join(",");
    return `${sorted}:${operator}`;
  }
}
