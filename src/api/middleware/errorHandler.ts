import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../../logger/logger";
import { AppError } from "./AppError";
import type { ErrorResponseDto } from "../dto/graphResponse.dto";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const body: ErrorResponseDto = {
      error: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
    logger.warn("AppError returned", { code: err.code, status: err.statusCode });
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ErrorResponseDto = {
      error: "Invalid query parameters",
      code: "BAD_REQUEST",
      details: err.flatten(),
    };
    logger.warn("Validation failed", { issues: err.flatten() });
    res.status(400).json(body);
    return;
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error("Unhandled error", { err });
  const body: ErrorResponseDto = {
    error: message,
    code: "INTERNAL_ERROR",
  };
  res.status(500).json(body);
}

export function notFoundHandler(_req: Request, res: Response): void {
  const body: ErrorResponseDto = {
    error: "Not Found",
    code: "NOT_FOUND",
  };
  res.status(404).json(body);
}
