import type { RequestHandler } from "express";
import { ZodError, type ZodType } from "zod";

import { ApiError } from "../lib/httpError";

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];
        next(
          new ApiError(
            400,
            "Validation Error",
            firstIssue?.message ?? "Invalid request body.",
          ),
        );
        return;
      }
      next(error);
    }
  };
}
