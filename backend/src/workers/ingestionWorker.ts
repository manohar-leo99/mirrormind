import { Worker } from "bullmq";

import { prisma } from "../prisma/client";
import {
  getIngestionStatus,
  startIngestion,
} from "../services/aiServiceClient";
import { createRedisConnection, type IngestionJobPayload } from "./queues";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toConnectionStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("complete") ||
    normalized.includes("success") ||
    normalized === "done"
  ) {
    return "ready";
  }
  if (normalized.includes("error") || normalized.includes("fail")) {
    return "failed";
  }
  if (
    normalized.includes("index") ||
    normalized.includes("process") ||
    normalized.includes("running")
  ) {
    return "running";
  }
  return "pending";
}

export function startIngestionWorker() {
  const worker = new Worker<IngestionJobPayload>(
    "ingestion",
    async (job) => {
      const ingestionJob = await prisma.ingestionJob.update({
        where: { id: job.id as string },
        data: {
          status: "running",
          errorMessage: null,
          startedAt: new Date(),
        },
      });

      await prisma.githubConnection.update({
        where: { id: ingestionJob.connectionId },
        data: {
          status: "running",
        },
      });

      try {
        const started = await startIngestion({
          repoUrl: job.data.repoUrl,
          teamId: job.data.teamId,
          githubToken: job.data.githubToken,
        });

        let isFinished = false;
        let guard = 0;

        while (!isFinished && guard < 120) {
          guard += 1;
          await delay(30_000);

          const status = await getIngestionStatus(started.jobId);
          const connectionStatus = toConnectionStatus(status.status);
          const isDone = connectionStatus === "ready";
          const hasFailed = connectionStatus === "failed";

          await prisma.ingestionJob.update({
            where: { id: ingestionJob.id },
            data: {
              status: isDone ? "completed" : hasFailed ? "failed" : "running",
              itemsProcessed: status.itemsProcessed,
              totalItems: status.totalItems,
              completedAt: isDone || hasFailed ? new Date() : null,
              errorMessage: hasFailed
                ? "Ingestion failed in AI service."
                : null,
            },
          });

          await prisma.githubConnection.update({
            where: { id: ingestionJob.connectionId },
            data: {
              status: connectionStatus,
              ...(isDone
                ? {
                    lastIngestedAt: new Date(),
                  }
                : {}),
            },
          });

          if (isDone) {
            isFinished = true;
          }

          if (hasFailed) {
            throw new Error("Ingestion failed in AI service.");
          }
        }

        if (!isFinished) {
          throw new Error("Ingestion timed out before completion.");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown ingestion failure";
        await prisma.ingestionJob.update({
          where: { id: ingestionJob.id },
          data: {
            status: "failed",
            errorMessage: message,
          },
        });

        await prisma.githubConnection.update({
          where: { id: ingestionJob.connectionId },
          data: {
            status: "failed",
          },
        });

        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("failed", (job, error) => {
    console.error("[ingestion-worker] Job failed", {
      jobId: job?.id,
      error: error.message,
    });
  });

  return worker;
}
