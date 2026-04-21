import "dotenv/config";

import app from "./app";
import { prisma } from "./prisma/client";
import { startIngestionWorker } from "./workers/ingestionWorker";
import { startPRReviewWorker } from "./workers/prReviewWorker";
import { closeQueueConnections } from "./workers/queues";
import { startScheduledSyncWorker } from "./workers/scheduledSync";

const port = Number(process.env.PORT ?? 4000);

const ingestionWorker = startIngestionWorker();
const prReviewWorker = startPRReviewWorker();
const scheduledSyncTask = startScheduledSyncWorker();

async function startServer() {
  await prisma.$connect();

  const server = app.listen(port, () => {
    console.info(`[backend] MirrorMind API listening on port ${port}`);
  });

  const shutdown = async () => {
    console.info("[backend] Graceful shutdown started...");

    scheduledSyncTask.stop();
    await Promise.allSettled([
      ingestionWorker.close(),
      prReviewWorker.close(),
      closeQueueConnections(),
      prisma.$disconnect(),
    ]);

    server.close(() => {
      console.info("[backend] Shutdown complete.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void startServer().catch((error) => {
  console.error("[backend] Failed to start server", error);
  process.exit(1);
});
