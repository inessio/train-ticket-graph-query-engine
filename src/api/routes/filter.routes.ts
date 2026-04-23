import { Router, Request, Response } from "express";
import type { FilterRegistry } from "../../core/filters/FilterRegistry";
import type { FilterDto } from "../dto/graphResponse.dto";

export function createFilterRouter(registry: FilterRegistry): Router {
  const router = Router();

  router.get("/filters", (_req: Request, res: Response) => {
    const body: FilterDto[] = registry.getAll().map((f) => ({
      name: f.name,
      description: f.description,
    }));
    res.status(200).json(body);
  });

  return router;
}
