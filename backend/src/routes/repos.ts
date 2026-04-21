import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../lib/asyncHandler";
import { ApiError } from "../lib/httpError";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validation";
import { prisma } from "../prisma/client";
import { parseRepoUrl } from "../services/githubService";
import { ingestionQueue } from "../workers/queues";

const router = Router();

const connectRepoSchema = z.object({
  repoUrl: z.string().url().includes("github.com"),
});

function mapIngestionStatus(
  jobStatus: string | null,
  connectionStatus: string,
): string {
  if (!jobStatus) {
    return mapConnectionStatus(connectionStatus);
  }

  if (jobStatus === "pending") {
    return "Processing";
  }
  if (jobStatus === "running") {
    return "Indexing";
  }
  if (jobStatus === "failed") {
    return "Error";
  }
  if (jobStatus === "completed") {
    return "Ready";
  }

  return mapConnectionStatus(connectionStatus);
}

function mapConnectionStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "ready") {
    return "Ready";
  }
  if (normalized === "failed" || normalized === "error") {
    return "Error";
  }
  if (normalized === "running" || normalized === "indexing") {
    return "Indexing";
  }
  if (normalized === "pending" || normalized === "processing") {
    return "Processing";
  }
  return "Connected";
}

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

router.use(authMiddleware);

router.get(
  "/repos",
  asyncHandler(async (req, res) => {
    const teamId = requireTeamId(req.user?.teamId);

    const repos = await prisma.githubConnection.findMany({
      where: { teamId },
      include: {
        ingestionJobs: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(
      repos.map((repo) => ({
        id: repo.id,
        repoName: repo.repoName,
        repoUrl: repo.repoUrl,
        status: mapConnectionStatus(repo.status),
        lastSyncedAt: repo.lastIngestedAt?.toISOString(),
        itemsIndexed: repo.ingestionJobs[0]?.itemsProcessed ?? 0,
      })),
    );
  }),
);

router.post(
  "/repos/connect",
  requireRole("admin"),
  validateBody(connectRepoSchema),
  asyncHandler(async (req, res) => {
    const teamId = requireTeamId(req.user?.teamId);
    const parsed = parseRepoUrl(req.body.repoUrl);

    const existing = await prisma.githubConnection.findFirst({
      where: {
        teamId,
        repoName: parsed.repoName,
      },
    });

    const connection = existing
      ? await prisma.githubConnection.update({
          where: { id: existing.id },
          data: {
            repoUrl: req.body.repoUrl,
            repoName: parsed.repoName,
            status: "pending",
          },
        })
      : await prisma.githubConnection.create({
          data: {
            teamId,
            repoName: parsed.repoName,
            repoUrl: req.body.repoUrl,
            status: "pending",
          },
        });

    const githubToken = req.user?.authToken;
    if (!githubToken) {
      throw new ApiError(
        400,
        "Validation Error",
        "GitHub token is required to trigger ingestion.",
      );
    }

    const ingestionJob = await prisma.ingestionJob.create({
      data: {
        teamId,
        connectionId: connection.id,
        status: "pending",
      },
    });

    await ingestionQueue.add(
      "ingest-repo",
      {
        teamId,
        repoId: connection.id,
        repoUrl: connection.repoUrl,
        githubToken,
        isFullSync: true,
      },
      {
        jobId: ingestionJob.id,
      },
    );

    res.status(201).json({
      id: connection.id,
      repoName: connection.repoName,
      repoUrl: connection.repoUrl,
      status: mapConnectionStatus(connection.status),
      lastSyncedAt: connection.lastIngestedAt?.toISOString(),
      itemsIndexed: 0,
    });
  }),
);

router.delete(
  "/repos/:repoId",
  asyncHandler(async (req, res) => {
    if (req.user?.role === "viewer") {
      throw new ApiError(403, "Forbidden", "Insufficient role for this action");
    }

    const teamId = requireTeamId(req.user?.teamId);
    const repoId = getParam(req.params.repoId);

    const existing = await prisma.githubConnection.findFirst({
      where: {
        id: repoId,
        teamId,
      },
    });

    if (!existing) {
      throw new ApiError(404, "Not Found", "Repository not found");
    }

    await prisma.githubConnection.delete({
      where: { id: existing.id },
    });

    res.json({ success: true });
  }),
);

router.get(
  "/ingestion/status",
  asyncHandler(async (req, res) => {
    const teamId = requireTeamId(req.user?.teamId);

    const connections = await prisma.githubConnection.findMany({
      where: { teamId },
      include: {
        ingestionJobs: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(
      connections.map((connection) => {
        const latestJob = connection.ingestionJobs[0];
        return {
          repoId: connection.id,
          repoName: connection.repoName,
          status: mapIngestionStatus(
            latestJob?.status ?? null,
            connection.status,
          ),
          itemsIndexed: latestJob?.itemsProcessed ?? 0,
          lastSyncedAt:
            connection.lastIngestedAt?.toISOString() ??
            latestJob?.completedAt?.toISOString() ??
            latestJob?.startedAt?.toISOString() ??
            latestJob?.createdAt.toISOString(),
        };
      }),
    );
  }),
);

router.post(
  "/ingestion/sync/:repoId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const teamId = requireTeamId(req.user?.teamId);
    const repoId = getParam(req.params.repoId);

    const repo = await prisma.githubConnection.findFirst({
      where: {
        id: repoId,
        teamId,
      },
    });

    if (!repo) {
      throw new ApiError(404, "Not Found", "Repository not found");
    }

    const githubToken = req.user?.authToken;
    if (!githubToken) {
      throw new ApiError(
        400,
        "Validation Error",
        "GitHub token is required to trigger ingestion.",
      );
    }

    const ingestionJob = await prisma.ingestionJob.create({
      data: {
        teamId,
        connectionId: repo.id,
        status: "pending",
      },
    });

    await ingestionQueue.add(
      "sync-repo",
      {
        teamId,
        repoId: repo.id,
        repoUrl: repo.repoUrl,
        githubToken,
        isFullSync: false,
      },
      {
        jobId: ingestionJob.id,
      },
    );

    res.status(202).json({
      jobId: ingestionJob.id,
      status: ingestionJob.status,
    });
  }),
);

export default router;
