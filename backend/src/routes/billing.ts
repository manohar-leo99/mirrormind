import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../lib/asyncHandler";
import { ApiError } from "../lib/httpError";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validation";
import { prisma } from "../prisma/client";

const router = Router();

const upgradeSchema = z.object({
  plan: z.string().min(2).max(40),
});

router.use(authMiddleware);
router.use(requireRole("admin"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user?.teamId) {
      throw new ApiError(404, "Not Found", "Team not found");
    }

    const subscription = await prisma.subscription.upsert({
      where: {
        teamId: req.user.teamId,
      },
      update: {},
      create: {
        teamId: req.user.teamId,
        plan: "free",
        status: "active",
      },
    });

    res.json({
      teamId: subscription.teamId,
      plan: subscription.plan,
      status: subscription.status,
      renewalDate: subscription.currentPeriodEnd?.toISOString() ?? null,
    });
  }),
);

router.post(
  "/upgrade",
  validateBody(upgradeSchema),
  asyncHandler(async (req, res) => {
    if (!req.user?.teamId) {
      throw new ApiError(404, "Not Found", "Team not found");
    }

    const plan = req.body.plan;
    await prisma.$transaction([
      prisma.subscription.upsert({
        where: {
          teamId: req.user.teamId,
        },
        update: {
          plan,
          status: "pending_checkout",
        },
        create: {
          teamId: req.user.teamId,
          plan,
          status: "pending_checkout",
        },
      }),
      prisma.team.update({
        where: {
          id: req.user.teamId,
        },
        data: {
          plan,
        },
      }),
    ]);

    res.json({
      mockCheckout: true,
      checkoutUrl: `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/dashboard/settings?upgrade=success`,
      plan,
      message:
        "Stripe checkout is skipped for MVP. Billing status was updated with mock data.",
    });
  }),
);

export default router;
