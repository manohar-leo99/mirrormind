import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { asyncHandler } from "../lib/asyncHandler";
import { ApiError } from "../lib/httpError";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validation";
import { prisma } from "../prisma/client";
import { sendTeamInviteEmail } from "../services/emailService";
import type { TeamRole } from "../types/auth";

const router = Router();

const createTeamSchema = z.object({
  name: z.string().min(2).max(80),
});

const updateTeamSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  plan: z.string().min(2).max(40).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "developer", "viewer"]),
});

const updateRoleSchema = z.object({
  role: z.enum(["admin", "developer", "viewer"]),
});

function toTeamRole(value: string | null | undefined): TeamRole {
  if (value === "admin" || value === "developer" || value === "viewer") {
    return value;
  }
  return "developer";
}

type TeamInviteClaims = {
  type: "team-invite";
  teamId: string;
  email: string;
  role: TeamRole;
  invitedById: string;
  iat?: number;
  exp?: number;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(
      500,
      "Internal Server Error",
      "JWT_SECRET is not configured.",
    );
  }
  return secret;
}

function createInviteToken(payload: {
  teamId: string;
  email: string;
  role: TeamRole;
  invitedById: string;
}): string {
  return jwt.sign(
    {
      type: "team-invite",
      teamId: payload.teamId,
      email: payload.email,
      role: payload.role,
      invitedById: payload.invitedById,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
    },
  );
}

function verifyInviteToken(token: string): TeamInviteClaims {
  const decoded = jwt.verify(token, getJwtSecret()) as TeamInviteClaims;
  if (decoded.type !== "team-invite") {
    throw new ApiError(400, "Validation Error", "Invalid invite token.");
  }
  return decoded;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

async function getMembership(userId: string, teamId?: string | null) {
  if (teamId) {
    const scoped = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId,
      },
      include: {
        team: true,
        user: true,
      },
    });

    if (scoped) {
      return scoped;
    }
  }

  return prisma.teamMember.findFirst({
    where: {
      userId,
    },
    include: {
      team: true,
      user: true,
    },
    orderBy: {
      joinedAt: "asc",
    },
  });
}

async function getTeamOrThrow(teamId: string | null | undefined) {
  if (!teamId) {
    throw new ApiError(404, "Not Found", "Team not found");
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    throw new ApiError(404, "Not Found", "Team not found");
  }

  return team;
}

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

router.use(authMiddleware);

router.post(
  "/",
  validateBody(createTeamSchema),
  asyncHandler(async (req, res) => {
    const existingMembership = await getMembership(
      req.user!.id,
      req.user?.teamId,
    );
    if (existingMembership?.team) {
      res.status(200).json(existingMembership.team);
      return;
    }

    if (req.user?.teamId) {
      const existingTeam = await prisma.team.findUnique({
        where: { id: req.user.teamId },
      });
      if (existingTeam) {
        res.status(200).json(existingTeam);
        return;
      }
    }

    const slug = `${slugify(req.body.name)}-${crypto.randomBytes(3).toString("hex")}`;
    const team = await prisma.team.create({
      data: {
        name: req.body.name,
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

    await prisma.teamMember.create({
      data: {
        userId: req.user!.id,
        teamId: team.id,
        role: "admin",
      },
    });

    res.status(201).json(team);
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const membership = await getMembership(req.user!.id, req.user?.teamId);
    const team = await getTeamOrThrow(membership?.teamId);

    const [teamMembers, reposConnected, totalQueries, prsReviewed] =
      await Promise.all([
        prisma.teamMember.count({ where: { teamId: team.id } }),
        prisma.githubConnection.count({ where: { teamId: team.id } }),
        prisma.query.count({ where: { teamId: team.id } }),
        prisma.pRReview.count({ where: { teamId: team.id } }),
      ]);

    res.json({
      id: team.id,
      name: team.name,
      slug: team.slug,
      plan: team.plan,
      totalQueries,
      prsReviewed,
      teamMembers,
      reposConnected,
    });
  }),
);

router.put(
  "/",
  requireRole("admin"),
  validateBody(updateTeamSchema),
  asyncHandler(async (req, res) => {
    const membership = await getMembership(req.user!.id, req.user?.teamId);
    const team = await getTeamOrThrow(membership?.teamId);

    const updated = await prisma.team.update({
      where: { id: team.id },
      data: {
        name: req.body.name,
        plan: req.body.plan,
      },
    });

    res.json(updated);
  }),
);

router.get(
  "/members",
  asyncHandler(async (req, res) => {
    const membership = await getMembership(req.user!.id, req.user?.teamId);
    const team = await getTeamOrThrow(membership?.teamId);

    const members = await prisma.teamMember.findMany({
      where: { teamId: team.id },
      include: {
        user: true,
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    res.json(
      members.map((member) => ({
        id: member.user.id,
        name: member.user.name ?? member.user.email,
        email: member.user.email,
        role: toTeamRole(member.role),
        lastActive: member.user.updatedAt.toISOString(),
      })),
    );
  }),
);

router.post(
  "/invite",
  requireRole("admin"),
  validateBody(inviteSchema),
  asyncHandler(async (req, res) => {
    const membership = await getMembership(req.user!.id, req.user?.teamId);
    const team = await getTeamOrThrow(membership?.teamId);

    const inviteToken = createInviteToken({
      teamId: team.id,
      email: req.body.email,
      role: req.body.role,
      invitedById: req.user!.id,
    });
    const invitedUser = await prisma.user.findUnique({
      where: {
        email: req.body.email,
      },
    });

    if (invitedUser) {
      await prisma.teamMember.upsert({
        where: {
          userId_teamId: {
            userId: invitedUser.id,
            teamId: team.id,
          },
        },
        update: {
          role: req.body.role,
        },
        create: {
          userId: invitedUser.id,
          teamId: team.id,
          role: req.body.role,
        },
      });
    }

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    await sendTeamInviteEmail({
      to: req.body.email,
      inviterName: req.user?.name ?? req.user?.email ?? "A teammate",
      teamName: team.name,
      role: req.body.role,
      inviteLink: `${frontendUrl}/auth/signin?invite=${inviteToken}`,
    });

    res.status(201).json({
      id: invitedUser?.id ?? inviteToken,
      email: req.body.email,
      role: req.body.role,
      inviteToken,
      userExists: Boolean(invitedUser),
    });
  }),
);

router.patch(
  "/members/:userId",
  requireRole("admin"),
  validateBody(updateRoleSchema),
  asyncHandler(async (req, res) => {
    const membership = await getMembership(req.user!.id, req.user?.teamId);
    const team = await getTeamOrThrow(membership?.teamId);
    const userId = getParam(req.params.userId);

    const member = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId: team.id,
      },
    });

    if (!member) {
      throw new ApiError(404, "Not Found", "Team member not found");
    }

    const updated = await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        role: req.body.role,
      },
    });

    res.json({
      id: userId,
      role: toTeamRole(updated.role),
    });
  }),
);

router.delete(
  "/members/:userId",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const membership = await getMembership(req.user!.id, req.user?.teamId);
    const team = await getTeamOrThrow(membership?.teamId);
    const userId = getParam(req.params.userId);

    if (userId === req.user?.id) {
      throw new ApiError(
        400,
        "Validation Error",
        "You cannot remove yourself from the team.",
      );
    }

    const member = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId: team.id,
      },
    });

    if (!member) {
      throw new ApiError(404, "Not Found", "Team member not found");
    }

    await prisma.teamMember.delete({
      where: { id: member.id },
    });

    res.json({ success: true });
  }),
);

router.post(
  "/join/:inviteToken",
  asyncHandler(async (req, res) => {
    const inviteToken = getParam(req.params.inviteToken);
    const invitation = verifyInviteToken(inviteToken);

    if (invitation.email.toLowerCase() !== req.user!.email.toLowerCase()) {
      throw new ApiError(
        403,
        "Forbidden",
        "Invitation email does not match current user.",
      );
    }

    await prisma.teamMember.upsert({
      where: {
        userId_teamId: {
          userId: req.user!.id,
          teamId: invitation.teamId,
        },
      },
      update: {
        role: invitation.role,
      },
      create: {
        userId: req.user!.id,
        teamId: invitation.teamId,
        role: invitation.role,
      },
    });

    res.json({
      success: true,
      teamId: invitation.teamId,
      role: invitation.role,
    });
  }),
);

export default router;
