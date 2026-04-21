import crypto from "crypto";
import { Router, raw } from "express";

import { asyncHandler } from "../lib/asyncHandler";
import { prisma } from "../prisma/client";
import { parseRepoUrl } from "../services/githubService";
import { prReviewQueue } from "../workers/queues";

const router = Router();

function verifyWebhookSignature(
  body: Buffer,
  signatureHeader: string | undefined,
): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;

  const signatureBuffer = Buffer.from(signatureHeader);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

router.post(
  "/github",
  raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const rawBody = req.body as Buffer;
    const signature = req.header("x-hub-signature-256");

    if (
      !Buffer.isBuffer(rawBody) ||
      !verifyWebhookSignature(rawBody, signature)
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const event = req.header("x-github-event");
    const payload = JSON.parse(rawBody.toString("utf8")) as {
      action?: string;
      repository?: { full_name?: string; name?: string };
      pull_request?: {
        number?: number;
        title?: string;
        html_url?: string;
        diff_url?: string;
        user?: { login?: string };
      };
    };

    if (
      event === "pull_request" &&
      (payload.action === "opened" || payload.action === "synchronize") &&
      payload.pull_request?.number &&
      payload.repository?.full_name
    ) {
      const repoConnection = await prisma.githubConnection.findFirst({
        where: {
          repoName: payload.repository.full_name,
        },
      });

      if (repoConnection) {
        const parsedRepo = parseRepoUrl(repoConnection.repoUrl);

        const existing = await prisma.pRReview.findFirst({
          where: {
            teamId: repoConnection.teamId,
            repoName: repoConnection.repoName,
            prNumber: payload.pull_request.number,
          },
        });

        const review = existing
          ? await prisma.pRReview.update({
              where: {
                id: existing.id,
              },
              data: {
                prTitle:
                  payload.pull_request.title ??
                  `PR #${payload.pull_request.number}`,
                prUrl:
                  payload.pull_request.html_url ??
                  `https://github.com/${repoConnection.repoName}/pull/${payload.pull_request.number}`,
                status: "pending",
              },
            })
          : await prisma.pRReview.create({
              data: {
                teamId: repoConnection.teamId,
                repoName: repoConnection.repoName,
                prNumber: payload.pull_request.number,
                prTitle:
                  payload.pull_request.title ??
                  `PR #${payload.pull_request.number}`,
                prUrl:
                  payload.pull_request.html_url ??
                  `https://github.com/${repoConnection.repoName}/pull/${payload.pull_request.number}`,
                status: "pending",
                reviewSummary: "Queued from webhook.",
                issuesJson: [] as unknown as object,
              },
            });

        await prReviewQueue.add(
          "webhook-pr-review",
          {
            reviewId: review.id,
            teamId: repoConnection.teamId,
            repoId: repoConnection.id,
            repoName: repoConnection.repoName,
            owner: parsedRepo.owner,
            repo: parsedRepo.repo,
            prNumber: payload.pull_request.number,
            prTitle:
              payload.pull_request.title ??
              `PR #${payload.pull_request.number}`,
            prDiff: "",
            prUrl:
              payload.pull_request.html_url ??
              `https://github.com/${repoConnection.repoName}/pull/${payload.pull_request.number}`,
            author: payload.pull_request.user?.login ?? "unknown",
            diffUrl: payload.pull_request.diff_url,
          },
          {
            jobId: review.id,
          },
        );
      }
    }

    res.status(200).json({ received: true });
  }),
);

export default router;
