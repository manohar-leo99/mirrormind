import { Queue } from "bullmq";
import IORedis from "ioredis";

type QueueLike<T> = {
  add(name: string, data: T, opts?: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
};

const redisUrl = process.env.REDIS_URL?.trim();

export const hasRedisConfiguration = Boolean(redisUrl);

export function createRedisConnection() {
  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured.");
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

function createMissingRedisQueue<T>(queueName: string): QueueLike<T> {
  return {
    async add() {
      throw new Error(
        `${queueName} queue is unavailable because REDIS_URL is not configured.`,
      );
    },
    async close() {
      return;
    },
  };
}

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

const producerConnection = hasRedisConfiguration ? createRedisConnection() : null;

const realIngestionQueue = hasRedisConfiguration
  ? new Queue<IngestionJobPayload>("ingestion", {
      connection: producerConnection as IORedis,
    })
  : null;

const realPrReviewQueue = hasRedisConfiguration
  ? new Queue<PRReviewJobPayload>("pr-review", {
      connection: producerConnection as IORedis,
    })
  : null;

export const ingestionQueue: QueueLike<IngestionJobPayload> =
  realIngestionQueue ?? createMissingRedisQueue<IngestionJobPayload>("ingestion");

export const prReviewQueue: QueueLike<PRReviewJobPayload> =
  realPrReviewQueue ?? createMissingRedisQueue<PRReviewJobPayload>("pr-review");

export async function closeQueueConnections() {
  if (!producerConnection || !realIngestionQueue || !realPrReviewQueue) {
    return;
  }

  await Promise.all([realIngestionQueue.close(), realPrReviewQueue.close()]);
  await producerConnection.quit();
}
