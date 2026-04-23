import express, { Express } from "express";
import { Server } from "http";
import { logger } from "./logger/logger";
import { config } from "./config/config";
import { loadData } from "./infrastructure/DataLoader";
import { RouteCache } from "./infrastructure/RouteCache";
import { buildGraph } from "./core/graph/GraphBuilder";
import { QueryEngine } from "./core/graph/QueryEngine";
import { FilterRegistry } from "./core/filters/FilterRegistry";
import { StartsFromPublicFilter } from "./core/filters/StartsFromPublicFilter";
import { EndsAtSinkFilter } from "./core/filters/EndsAtSinkFilter";
import { HasVulnerabilityFilter } from "./core/filters/HasVulnerabilityFilter";
import { requestLogger } from "./api/middleware/requestLogger";
import { errorHandler, notFoundHandler } from "./api/middleware/errorHandler";
import { createGraphRouter } from "./api/routes/graph.routes";
import { createFilterRouter } from "./api/routes/filter.routes";

export interface AppBundle {
  app: Express;
  registry: FilterRegistry;
}

export async function buildApp(): Promise<AppBundle> {
  logger.info("Startup step 1/6: configuration loaded", {
    port: config.PORT,
    env: config.NODE_ENV,
    dataFile: config.DATA_FILE_PATH,
  });

  logger.info("Startup step 2/6: loading data file");
  const data = await loadData(config.DATA_FILE_PATH);

  logger.info("Startup step 3/6: building graph");
  const graph = buildGraph({ nodes: data.nodes, edges: data.edges });

  logger.info("Startup step 4/6: computing routes");
  const routes = QueryEngine.compute(graph);

  logger.info("Startup step 5/6: priming RouteCache");
  RouteCache.prime(routes);

  logger.info("Startup step 6/6: registering filters");
  const registry = new FilterRegistry();
  registry.register(new StartsFromPublicFilter());
  registry.register(new EndsAtSinkFilter());
  registry.register(new HasVulnerabilityFilter());

  const app = express();
  app.use(requestLogger);
  app.use(express.json());

  const graphRouter = createGraphRouter({
    graph,
    allRoutes: routes,
    registry,
  });
  const filterRouter = createFilterRouter(registry);

  app.use("/api/v1", graphRouter);
  app.use("/api/v1", filterRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, registry };
}

export async function start(): Promise<Server> {
  const { app } = await buildApp();
  const server = app.listen(config.PORT, () => {
    logger.info(`Express listening on port ${config.PORT}`);
  });

  const shutdown = (signal: string) => {
    logger.info("Shutting down gracefully", { signal });
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}

if (require.main === module) {
  start().catch((err) => {
    logger.error("Startup failed", { err });
    process.exit(1);
  });
}
