import { Worker } from "bullmq";

import { prisma } from "../prisma/client";
import { reviewPR } from "../services/aiServiceClient";
import {
  fetchDiffFromUrl,
  postPullRequestComment,
} from "../services/githubService";
import {
  createRedisConnection,
  hasRedisConfiguration,
  type PRReviewJobPayload,
} from "./queues";

type WorkerHandle = {
  close(): Promise<void>;
};

function buildGitHubComment(
  summary: string,
  issues: Array<{ severity: string; description: string; suggestion?: string }>,
) {
  const header = `## MirrorMind AI Review\n\n${summary}`;
  if (issues.length === 0) {
    return `${header}\n\nNo significant issues were detected.`;
  }

  const issueLines = issues
    .map((issue, index) => {
      const suggestion = issue.suggestion
        ? `\nSuggestion: ${issue.suggestion}`
        : "";
      return `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}${suggestion}`;
    })
    .join("\n\n");

  return `${header}\n\n### Issues\n${issueLines}`;
}

function normalizeSeverity(value: string): "info" | "warning" | "error" {
  const normalized = value.toLowerCase();
  if (normalized.includes("error") || normalized.includes("critical")) {
    return "error";
  }
  if (normalized.includes("warn")) {
    return "warning";
  }
  return "info";
}

export function startPRReviewWorker(): WorkerHandle {
  if (!hasRedisConfiguration) {
    console.warn(
      "[pr-review-worker] REDIS_URL is not configured; worker disabled.",
    );

    return {
      async close() {
        return;
      },
    };
  }

  const worker = new Worker<PRReviewJobPayload>(
    "pr-review",
    async (job) => {
      const payload = job.data;

      let diff = payload.prDiff;
      if (!diff && payload.diffUrl) {
        diff = await fetchDiffFromUrl({
          diffUrl: payload.diffUrl,
          accessToken: payload.githubToken,
        });
      }

      await prisma.pRReview.update({
        where: { id: payload.reviewId },
        data: {
          status: "reviewing",
        },
      });

      try {
        const review = await reviewPR({
          prDiff: diff,
          prTitle: payload.prTitle,
          teamId: payload.teamId,
        });

        const issues = review.issues.map((issue) => ({
          severity: normalizeSeverity(issue.severity),
          message: issue.description,
          snippet: issue.suggestion,
        }));

        if (payload.githubToken) {
          const body = buildGitHubComment(review.summary, review.issues);
          await postPullRequestComment({
            owner: payload.owner,
            repo: payload.repo,
            prNumber: payload.prNumber,
            body,
            accessToken: payload.githubToken,
          });
        }

        await prisma.pRReview.update({
          where: { id: payload.reviewId },
          data: {
            status: "completed",
            reviewSummary: review.summary,
            issuesJson: issues as unknown as object,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown review failure";
        await prisma.pRReview.update({
          where: { id: payload.reviewId },
          data: {
            status: "failed",
            reviewSummary: message,
          },
        });

        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 4,
    },
  );

  worker.on("failed", (job, error) => {
    console.error("[pr-review-worker] Job failed", {
      jobId: job?.id,
      error: error.message,
    });
  });

  return worker;
}
