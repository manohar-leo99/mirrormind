import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export function createRedisConnection() {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

const producerConnection = createRedisConnection();

export type IngestionJobPayload = {
  teamId: string;
  repoId: string;
  repoUrl: string;
  githubToken: string;
  isFullSync: boolean;
};

export type PRReviewJobPayload = {
  reviewId: string;
  teamId: string;
  repoId: string;
  repoName: string;
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prDiff: string;
  prUrl: string;
  author: string;
  githubToken?: string;
  diffUrl?: string;
};

export const ingestionQueue = new Queue<IngestionJobPayload>("ingestion", {
  connection: producerConnection,
});

export const prReviewQueue = new Queue<PRReviewJobPayload>("pr-review", {
  connection: producerConnection,
});

export async function closeQueueConnections() {
  await Promise.all([ingestionQueue.close(), prReviewQueue.close()]);
  await producerConnection.quit();
}
