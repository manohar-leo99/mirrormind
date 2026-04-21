import type { RequestHandler } from "express";

import { ApiError } from "../lib/httpError";
import type { TeamRole } from "../types/auth";

export function requireRole(requiredRole: TeamRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, "Unauthorized", "Token invalid or expired"));
      return;
    }

    if (req.user.role !== requiredRole) {
      next(new ApiError(403, "Forbidden", "Admin role required"));
      return;
    }

    next();
  };
}
