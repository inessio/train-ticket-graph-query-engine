import { logger } from "../logger/logger";
import type { Route } from "../core/graph/types";

const store: Map<string, Route[]> = new Map();

export const RouteCache = {
  prime(routes: Route[]): void {
    store.set("all", routes);
    logger.info("RouteCache primed", { count: routes.length });
  },

  get(key: string): Route[] | undefined {
    const hit = store.get(key);
    if (hit === undefined) {
      logger.debug("RouteCache miss", { key });
      return undefined;
    }
    logger.debug("RouteCache hit", { key, count: hit.length });
    return hit;
  },

  set(key: string, routes: Route[]): void {
    store.set(key, routes);
    logger.debug("RouteCache set", { key, count: routes.length });
  },

  flush(): void {
    store.clear();
    logger.debug("RouteCache flushed");
  },

  size(): number {
    return store.size;
  },
} as const;
