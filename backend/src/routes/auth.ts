import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../lib/asyncHandler";
import { ApiError } from "../lib/httpError";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { prisma } from "../prisma/client";
import {
  exchangeCodeForAccessToken,
  getGitHubProfile,
  type GitHubProfile,
} from "../services/githubService";
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from "../services/jwtService";
import type { TeamRole } from "../types/auth";

const router = Router();

const githubSyncSchema = z.object({
  githubId: z.union([z.string(), z.number()]).optional(),
  email: z.string().email().nullable().optional(),
  name: z.string().min(1).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

const githubCallbackSchema = z.object({
  code: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function defaultTeamName(name?: string | null): string {
  if (!name) {
    return "MirrorMind Team";
  }
  const firstName = name.split(" ")[0];
  return `${firstName} Team`;
}

function toTeamRole(value: string | null | undefined): TeamRole {
  if (value === "admin" || value === "developer" || value === "viewer") {
    return value;
  }
  return "developer";
}

async function createUniqueTeam(name: string) {
  for (let i = 0; i < 5; i += 1) {
    const suffix = crypto.randomBytes(3).toString("hex");
    const slug = `${slugify(name)}-${suffix}`;

    try {
      return await prisma.team.create({
        data: {
          name,
          slug,
          plan: "free",
          subscription: {
            create: {
              plan: "free",
              status: "active",
            },
          },
        },
      });
    } catch {
      // Retry on slug collisions.
    }
  }

  throw new ApiError(
    500,
    "Internal Server Error",
    "Could not create team slug.",
  );
}

async function issueTokens(payload: {
  userId: string;
  teamId: string | null;
  role: TeamRole;
}) {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return { accessToken, refreshToken };
}

async function upsertUserFromGitHub(payload: {
  githubId?: string;
  email: string;
  name?: string;
  avatarUrl?: string | null;
}) {
  const githubId =
    payload.githubId ?? `gh-${crypto.randomBytes(8).toString("hex")}`;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ githubId }, { email: payload.email }],
    },
  });

  let user = existing;
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    user = await prisma.user.create({
      data: {
        githubId,
        email: payload.email,
        name: payload.name ?? payload.email,
        avatarUrl: payload.avatarUrl ?? null,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        githubId: githubId ?? user.githubId,
        email: payload.email,
        name: payload.name ?? user.name,
        avatarUrl: payload.avatarUrl ?? user.avatarUrl,
      },
    });
  }

  let membership = await prisma.teamMember.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      joinedAt: "asc",
    },
    include: {
      team: true,
    },
  });

  if (!membership) {
    const team = await createUniqueTeam(defaultTeamName(payload.name));
    membership = await prisma.teamMember.create({
      data: {
        userId: user.id,
        teamId: team.id,
        role: "admin",
      },
      include: {
        team: true,
      },
    });
  }

  return {
    user,
    membership,
    team: membership.team,
    isNewUser,
  };
}

function profileToEmail(profile: GitHubProfile): string {
  if (profile.email) {
    return profile.email;
  }
  return `${profile.login}@users.noreply.github.com`;
}

router.post(
  "/github/sync",
  validateBody(githubSyncSchema),
  asyncHandler(async (req, res) => {
    const githubId = req.body.githubId ? String(req.body.githubId) : undefined;
    const email =
      req.body.email ??
      (githubId ? `${githubId}@users.noreply.github.com` : null);
    if (!email) {
      throw new ApiError(
        400,
        "Validation Error",
        "A valid email is required for sync.",
      );
    }

    const { user, membership, isNewUser } = await upsertUserFromGitHub({
      githubId,
      email,
      name: req.body.name ?? undefined,
      avatarUrl: req.body.avatarUrl,
    });

    const tokens = await issueTokens({
      userId: user.id,
      teamId: membership.teamId,
      role: toTeamRole(membership.role),
    });

    res.json({
      userId: user.id,
      teamId: membership.teamId,
      role: toTeamRole(membership.role),
      isNewUser,
      ...tokens,
    });
  }),
);

router.post(
  "/github/callback",
  validateBody(githubCallbackSchema),
  asyncHandler(async (req, res) => {
    const accessTokenFromGitHub = await exchangeCodeForAccessToken(
      req.body.code,
    );
    const profile = await getGitHubProfile(accessTokenFromGitHub);

    const { user, membership, isNewUser } = await upsertUserFromGitHub({
      githubId: String(profile.id),
      email: profileToEmail(profile),
      name: profile.name ?? undefined,
      avatarUrl: profile.avatar_url,
    });

    const tokens = await issueTokens({
      userId: user.id,
      teamId: membership.teamId,
      role: toTeamRole(membership.role),
    });

    res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        teamId: membership.teamId,
        role: toTeamRole(membership.role),
        githubAccessToken: accessTokenFromGitHub,
        isNewUser,
      },
    });
  }),
);

router.post(
  "/refresh",
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const decoded = verifyToken(req.body.refreshToken);
    if (decoded.type !== "refresh") {
      throw new ApiError(401, "Unauthorized", "Token invalid or expired");
    }

    const membership = decoded.teamId
      ? await prisma.teamMember.findFirst({
          where: {
            userId: decoded.userId,
            teamId: decoded.teamId,
          },
        })
      : null;

    const accessToken = signAccessToken({
      userId: decoded.userId,
      teamId: membership?.teamId ?? decoded.teamId,
      role: membership ? toTeamRole(membership.role) : decoded.role,
    });

    res.json({ accessToken });
  }),
);

router.post(
  "/logout",
  authMiddleware,
  validateBody(logoutSchema),
  asyncHandler(async (req, res) => {
    res.json({ success: true });
  }),
);

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const membership = req.user?.teamId
      ? await prisma.teamMember.findFirst({
          where: {
            userId: req.user.id,
            teamId: req.user.teamId,
          },
          include: {
            team: true,
          },
        })
      : await prisma.teamMember.findFirst({
          where: {
            userId: req.user!.id,
          },
          include: {
            team: true,
          },
          orderBy: {
            joinedAt: "asc",
          },
        });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      throw new ApiError(404, "Not Found", "User not found");
    }

    const teamMembers = membership?.teamId
      ? await prisma.teamMember.count({ where: { teamId: membership.teamId } })
      : 0;
    const reposConnected = membership?.teamId
      ? await prisma.githubConnection.count({
          where: { teamId: membership.teamId },
        })
      : 0;
    const totalQueries = membership?.teamId
      ? await prisma.query.count({ where: { teamId: membership.teamId } })
      : 0;
    const prsReviewed = membership?.teamId
      ? await prisma.pRReview.count({ where: { teamId: membership.teamId } })
      : 0;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: toTeamRole(membership?.role),
      },
      team: membership?.team
        ? {
            id: membership.team.id,
            name: membership.team.name,
            slug: membership.team.slug,
            plan: membership.team.plan,
            totalQueries,
            prsReviewed,
            teamMembers,
            reposConnected,
          }
        : null,
    });
  }),
);

export default router;
