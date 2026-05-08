import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../lib/asyncHandler";
import { ApiError } from "../lib/httpError";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { prisma } from "../prisma/client";
import { getPullRequestDetails, parseRepoUrl } from "../services/githubService";
import { prReviewQueue } from "../workers/queues";

const router = Router();

const triggerReviewSchema = z.object({
  prNumber: z.number().int().positive(),
  repoName: z.string().min(1),
});

function requireTeamId(teamId: string | null | undefined): string {
  if (!teamId) {
    throw new ApiError(404, "Not Found", "Team not found");
  }
  return teamId;
}

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function mapIssue(issue: unknown): {
  severity: string;
  message: string;
  snippet?: string;
} {
  const normalized = issue as {
    severity?: string;
    message?: string;
    description?: string;
    suggestion?: string;
    snippet?: string;
  };

  return {
    severity: normalized.severity ?? "info",
    message: normalized.message ?? normalized.description ?? "Issue detected",
    snippet: normalized.snippet ?? normalized.suggestion,
  };
}

function mapReview(review: {
  id: string;
  title: string;
  author: string;
  repoName: string;
  openedAt: Date;
  status: string;
  prNumber: number;
  prUrl: string;
  summary: string | null;
  issues: unknown;
}) {
  const rawIssues = Array.isArray(review.issues) ? review.issues : [];
  const normalizedStatus =
    review.status === "completed"
      ? "Reviewed"
      : review.status === "pending"
        ? "Pending"
        : review.status === "reviewing"
          ? "Reviewing..."
          : review.status === "failed"
            ? "Error"
            : review.status;

  return {
    id: review.id,
    title: review.title,
    author: review.author,
    repoName: review.repoName,
    openedAt: review.openedAt.toISOString(),
    status: normalizedStatus,
    prNumber: review.prNumber,
    prUrl: review.prUrl,
    summary: review.summary ?? undefined,
    issues: rawIssues.map(mapIssue),
  };
}

router.use(authMiddleware);

router.get(
  "/reviews/prs",
  asyncHandler(async (req, res) => {
    const teamId = requireTeamId(req.user?.teamId);

    const reviews = await prisma.pRReview.findMany({
      where: {
        teamId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(
      reviews.map(
        (review: (typeof reviews)[number]) =>
          mapReview({
            ...review,
            title: review.prTitle || `PR #${review.prNumber}`,
            author: "unknown",
            openedAt: review.createdAt,
            prUrl:
              review.prUrl ||
              `https://github.com/${review.repoName}/pull/${review.prNumber}`,
            summary: review.reviewSummary,
            issues: review.issuesJson,
          }) as ReturnType<typeof mapReview>,
      ),
    );
  }),
);

router.get(
  "/reviews/:prId",
  asyncHandler(async (req, res) => {
    const teamId = requireTeamId(req.user?.teamId);
    const prId = getParam(req.params.prId);

    const review = await prisma.pRReview.findFirst({
      where: {
        id: prId,
        teamId,
      },
    });

    if (!review) {
      throw new ApiError(404, "Not Found", "PR review not found");
    }

    res.json(
      mapReview({
        ...review,
        title: review.prTitle || `PR #${review.prNumber}`,
        author: "unknown",
        openedAt: review.createdAt,
        prUrl:
          review.prUrl ||
          `https://github.com/${review.repoName}/pull/${review.prNumber}`,
        summary: review.reviewSummary,
        issues: review.issuesJson,
      }) as ReturnType<typeof mapReview>,
    );
  }),
);

router.post(
  "/reviews/trigger",
  validateBody(triggerReviewSchema),
  asyncHandler(async (req, res) => {
    const teamId = requireTeamId(req.user?.teamId);

    const repoConnection = await prisma.githubConnection.findFirst({
      where: {
        teamId,
        repoName: req.body.repoName,
      },
    });

    if (!repoConnection) {
      throw new ApiError(404, "Not Found", "Repository not found");
    }

    const githubToken = req.user?.githubToken ?? req.user?.authToken;
    if (!githubToken) {
      throw new ApiError(
        400,
        "Validation Error",
        "GitHub token unavailable for fetching PR details.",
      );
    }

    const parsed = parseRepoUrl(repoConnection.repoUrl);

    const prDetails = await getPullRequestDetails({
      owner: parsed.owner,
      repo: parsed.repo,
      prNumber: req.body.prNumber,
      accessToken: githubToken,
    });

    const existing = await prisma.pRReview.findFirst({
      where: {
        teamId,
        repoName: repoConnection.repoName,
        prNumber: req.body.prNumber,
      },
    });

    const review = existing
      ? await prisma.pRReview.update({
          where: {
            id: existing.id,
          },
          data: {
            prTitle: prDetails.title,
            prUrl: prDetails.prUrl,
            status: "reviewing",
          },
        })
      : await prisma.pRReview.create({
          data: {
            teamId,
            repoName: repoConnection.repoName,
            prNumber: req.body.prNumber,
            prTitle: prDetails.title,
            prUrl: prDetails.prUrl,
            status: "reviewing",
            reviewSummary: "Review in progress.",
            issuesJson: [] as unknown as object,
          },
        });

    await prReviewQueue.add(
      "manual-pr-review",
      {
        reviewId: review.id,
        teamId,
        repoId: repoConnection.id,
        repoName: repoConnection.repoName,
        owner: parsed.owner,
        repo: parsed.repo,
        prNumber: req.body.prNumber,
        prTitle: prDetails.title,
        prDiff: prDetails.diff,
        prUrl: prDetails.prUrl,
        author: prDetails.author,
        githubToken,
      },
      {
        jobId: review.id,
      },
    );

    res.status(202).json({
      queued: true,
      reviewId: review.id,
      status: "Reviewing...",
    });
  }),
);

export default router;
