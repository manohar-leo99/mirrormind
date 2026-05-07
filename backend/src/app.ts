import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth";
import billingRoutes from "./routes/billing";
import queryRoutes from "./routes/query";
import reposRoutes from "./routes/repos";
import reviewsRoutes from "./routes/reviews";
import teamRoutes from "./routes/team";
import webhooksRoutes from "./routes/webhooks";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { generalRateLimiter } from "./middleware/rateLimiter";

const app = express();

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  const configured = (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  const defaults = ["http://localhost:3000", "https://localhost:3000"];
  const allowList = new Set([...configured, ...defaults]);

  if (allowList.has(normalizedOrigin)) {
    return true;
  }

  // Keep dev tunnels working.
  return /\.trycloudflare\.com$/i.test(normalizedOrigin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin ?? "unknown"}`));
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Webhook route must parse raw body for HMAC signature verification.
app.use("/api/webhooks", webhooksRoutes);

app.use(generalRateLimiter);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api", reposRoutes);
app.use("/api", queryRoutes);
app.use("/api", reviewsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
