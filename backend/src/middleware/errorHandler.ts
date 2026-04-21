import type { ErrorRequestHandler, RequestHandler } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { ZodError } from "zod";

import { ApiError } from "../lib/httpError";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, "Not Found", "Resource not found"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.error,
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  if (err instanceof ZodError) {
    const issue = err.issues[0];
    res.status(400).json({
      error: "Validation Error",
      message: issue?.message ?? "Invalid request payload",
      statusCode: 400,
    });
    return;
  }

  if (err instanceof TokenExpiredError || err instanceof JsonWebTokenError) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Token invalid or expired",
      statusCode: 401,
    });
    return;
  }

  const maybeCode = (err as { code?: string } | undefined)?.code;
  if (maybeCode === "ECONNREFUSED" || maybeCode === "ETIMEDOUT") {
    res.status(503).json({
      error: "Service Unavailable",
      message: "AI service is not responding. Try again.",
      statusCode: 503,
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong",
    statusCode: 500,
  });
};
