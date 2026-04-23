import type { NextFunction, Request, Response } from "express";
import { logger } from "../../logger/logger";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startedAt = Date.now();
  logger.info("Incoming request", {
    method: req.method,
    url: req.originalUrl,
  });

  res.on("finish", () => {
    logger.info("Request completed", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}
