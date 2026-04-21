import crypto from "crypto";

import IORedis from "ioredis";

type CachedQueryPayload = {
  answer: string;
  sources: unknown[];
};

const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("error", (error) => {
  console.warn("[redis] cache error", error.message);
});

function buildQuestionHash(question: string): string {
  return crypto
    .createHash("sha256")
    .update(question.trim().toLowerCase())
    .digest("hex");
}

function getQueryCacheKey(teamId: string, question: string): string {
  return `cache:query:${teamId}:${buildQuestionHash(question)}`;
}

export async function getCachedQueryAnswer(
  teamId: string,
  question: string,
): Promise<CachedQueryPayload | null> {
  try {
    const key = getQueryCacheKey(teamId, question);
    const value = await redis.get(key);
    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value) as CachedQueryPayload;
    return {
      answer: parsed.answer,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch {
    return null;
  }
}

export async function setCachedQueryAnswer(payload: {
  teamId: string;
  question: string;
  answer: string;
  sources: unknown[];
  ttlSeconds?: number;
}): Promise<void> {
  const ttlSeconds = payload.ttlSeconds ?? 3600;
  try {
    const key = getQueryCacheKey(payload.teamId, payload.question);
    await redis.set(
      key,
      JSON.stringify({
        answer: payload.answer,
        sources: payload.sources,
      }),
      "EX",
      ttlSeconds,
    );
  } catch {
    // Cache failures should not impact request flow.
  }
}
