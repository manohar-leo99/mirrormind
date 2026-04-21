import cron, { type ScheduledTask } from "node-cron";

import { prisma } from "../prisma/client";
import { ingestionQueue } from "./queues";

async function enqueueIncrementalSyncJobs() {
  const githubToken = process.env.SCHEDULED_SYNC_GITHUB_TOKEN;
  if (!githubToken) {
    return;
  }

  const repos = await prisma.githubConnection.findMany({
    where: {
      status: {
        not: "failed",
      },
    },
  });

  for (const repo of repos) {
    const ingestionJob = await prisma.ingestionJob.create({
      data: {
        teamId: repo.teamId,
        connectionId: repo.id,
        status: "pending",
      },
    });

    await ingestionQueue.add(
      "incremental-sync",
      {
        teamId: repo.teamId,
        repoId: repo.id,
        repoUrl: repo.repoUrl,
        githubToken,
        isFullSync: false,
      },
      {
        jobId: ingestionJob.id,
      },
    );
  }
}

export function startScheduledSyncWorker(): ScheduledTask {
  return cron.schedule("0 0 * * *", () => {
    void enqueueIncrementalSyncJobs().catch((error) => {
      console.error("[scheduled-sync] Failed to enqueue jobs", error);
    });
  });
}
