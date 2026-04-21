import type { RequestHandler } from "express";

import { ApiError } from "../lib/httpError";

type LimiterConfig = {
  windowMs: number;
  max: number;
  keyGenerator: (requestKey: { ip: string; userId?: string }) => string;
  skip?: (path: string) => boolean;
};

type Bucket = {
  count: number;
  startMs: number;
};

function createLimiter(config: LimiterConfig): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, _res, next) => {
    if (config.skip?.(req.path)) {
      next();
      return;
    }

    const now = Date.now();
    const key = config.keyGenerator({
      ip: req.ip || "unknown",
      userId: req.user?.id,
    });

    const bucket = buckets.get(key);
    if (!bucket || now - bucket.startMs >= config.windowMs) {
      buckets.set(key, { count: 1, startMs: now });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > config.max) {
      next(
        new ApiError(
          429,
          "Rate Limited",
          "Too many requests. Try again in 60 seconds.",
        ),
      );
      return;
    }

    next();
  };
}

export const generalRateLimiter = createLimiter({
  windowMs: 60_000,
  max: 100,
  keyGenerator: ({ ip }) => `ip:${ip}`,
  skip: (path) => path.startsWith("/webhooks/github"),
});

export const queryRateLimiter = createLimiter({
  windowMs: 60_000,
  max: 20,
  keyGenerator: ({ ip, userId }) => `query:${userId ?? ip}`,
});
