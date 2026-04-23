import type { NextFunction, Request, Response } from "express";
import { ZodError, ZodTypeAny } from "zod";
import { AppError } from "./AppError";

declare module "express-serve-static-core" {
  interface Request {
    validatedQuery?: unknown;
  }
}

export function validateQuery<S extends ZodTypeAny>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.validatedQuery = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new AppError(400, "BAD_REQUEST", "Invalid query parameters", err.flatten())
        );
        return;
      }
      next(err);
    }
  };
}
