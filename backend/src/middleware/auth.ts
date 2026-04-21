import crypto from "crypto";
import type { RequestHandler } from "express";

import { prisma } from "../prisma/client";
import { getGitHubProfile } from "../services/githubService";
import { verifyToken } from "../services/jwtService";
import type { TeamRole } from "../types/auth";

function toTeamRole(value: string | null | undefined): TeamRole {
  if (value === "admin" || value === "developer" || value === "viewer") {
    return value;
  }
  return "developer";
}

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
      // Retry on potential slug collisions.
    }
  }

  throw new Error("Failed to create team");
}

async function ensureMembership(
  userId: string,
  preferredTeamId?: string | null,
) {
  const existing = await getMembership(userId, preferredTeamId);
  if (existing) {
    return existing;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const team = await createUniqueTeam(defaultTeamName(user?.name));

  return prisma.teamMember.create({
    data: {
      userId,
      teamId: team.id,
      role: "admin",
    },
  });
}

async function getMembership(userId: string, preferredTeamId?: string | null) {
  if (preferredTeamId) {
    const byTeam = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId: preferredTeamId,
      },
    });

    if (byTeam) {
      return byTeam;
    }
  }

  return prisma.teamMember.findFirst({
    where: { userId },
    orderBy: {
      joinedAt: "asc",
    },
  });
}

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const claims = verifyToken(token);
    if (claims.type !== "access") {
      throw new Error("Token is not an access token");
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
    });

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const membership = await ensureMembership(user.id, claims.teamId);

    req.user = {
      id: user.id,
      teamId: membership.teamId,
      role: toTeamRole(membership.role),
      email: user.email,
      name: user.name,
      githubId: user.githubId,
      authToken: token,
    };

    next();
    return;
  } catch {
    // Fall through to GitHub-token compatibility path for current frontend session tokens.
  }

  try {
    const profile = await getGitHubProfile(token);
    const githubId = String(profile.id);
    const fallbackEmail =
      profile.email ?? `${githubId}@users.noreply.github.com`;
    const user = await prisma.user.findFirst({
      where: profile.email
        ? {
            OR: [{ githubId }, { email: profile.email }],
          }
        : { githubId },
    });

    const resolvedUser = user
      ? await prisma.user.update({
          where: { id: user.id },
          data: {
            githubId,
            name: profile.name ?? user.name,
            avatarUrl: profile.avatar_url ?? user.avatarUrl,
          },
        })
      : await prisma.user.create({
          data: {
            githubId,
            email: fallbackEmail,
            name: profile.name ?? profile.login ?? fallbackEmail,
            avatarUrl: profile.avatar_url,
          },
        });

    const membership = await ensureMembership(resolvedUser.id);

    req.user = {
      id: resolvedUser.id,
      teamId: membership.teamId,
      role: toTeamRole(membership.role),
      email: resolvedUser.email,
      name: resolvedUser.name,
      githubId: resolvedUser.githubId,
      authToken: token,
    };

    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};
