import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../lib/asyncHandler";
import { ApiError } from "../lib/httpError";
import { authMiddleware } from "../middleware/auth";
import { queryRateLimiter } from "../middleware/rateLimiter";
import { validateBody } from "../middleware/validation";
import { prisma } from "../prisma/client";
import { queryKnowledgeStream } from "../services/aiServiceClient";
import {
  getCachedQueryAnswer,
  setCachedQueryAnswer,
} from "../services/redisCache";

const router = Router();

const querySchema = z.object({
  question: z.string().min(1),
  conversationId: z.string().min(1).nullable().optional(),
});

const feedbackSchema = z.object({
  queryId: z.string().min(1),
  rating: z.enum(["up", "down", "thumbs_up", "thumbs_down"]),
});

type ParsedStreamState = {
  buffer: string;
  assistantContent: string;
  sources: unknown[];
};

type ConversationResponse = {
  id: string;
  title: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: unknown[];
    createdAt: string;
  }>;
};

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function consumeSseChunk(state: ParsedStreamState, chunk: string) {
  state.buffer += chunk;
  const packets = state.buffer.split("\n\n");
  state.buffer = packets.pop() ?? "";

  for (const packet of packets) {
    const lines = packet
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"));

    for (const line of lines) {
      const payload = line.replace("data:", "").trim();
      if (!payload) {
        continue;
      }

      try {
        const parsed = JSON.parse(payload) as {
          type?: string;
          content?: string;
          sources?: unknown[];
        };

        if (parsed.type === "token" && parsed.content) {
          state.assistantContent += parsed.content;
        }

        if (parsed.type === "done" && Array.isArray(parsed.sources)) {
          state.sources = parsed.sources;
        }
      } catch {
        // Ignore malformed packets from upstream stream.
      }
    }
  }
}

function normalizeConversationId(conversationId?: string | null): string {
  const trimmed = conversationId?.trim();
  if (trimmed) {
    return trimmed;
  }
  return randomUUID();
}

function toSourcesArray(value: Prisma.JsonValue | null): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

function buildConversationFromQueries(
  conversationId: string,
  rows: Array<{
    id: string;
    question: string;
    answer: string;
    sourcesJson: Prisma.JsonValue | null;
    createdAt: Date;
  }>,
): ConversationResponse {
  const messages: ConversationResponse["messages"] = [];

  for (const row of rows) {
    messages.push({
      id: `${row.id}:q`,
      role: "user",
      content: row.question,
      citations: [],
      createdAt: row.createdAt.toISOString(),
    });

    messages.push({
      id: `${row.id}:a`,
      role: "assistant",
      content: row.answer,
      citations: toSourcesArray(row.sourcesJson),
      createdAt: row.createdAt.toISOString(),
    });
  }

  const first = rows[0];
  const last = rows[rows.length - 1];

  return {
    id: conversationId,
    title: first?.question.slice(0, 72) ?? "New conversation",
    updatedAt: (last?.createdAt ?? new Date()).toISOString(),
    messages,
  };
}

router.use(authMiddleware);

router.post(
  "/query",
  queryRateLimiter,
  validateBody(querySchema),
  asyncHandler(async (req, res) => {
    if (!req.user?.teamId) {
      throw new ApiError(404, "Not Found", "Team not found");
    }

    const conversationId = normalizeConversationId(req.body.conversationId);
    const question = req.body.question.trim();

    const cached = await getCachedQueryAnswer(req.user.teamId, question);
    if (cached) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      res.write(
        `data: ${JSON.stringify({ type: "token", content: cached.answer })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ type: "done", sources: cached.sources })}\n\n`,
      );

      await prisma.query.create({
        data: {
          teamId: req.user.teamId,
          userId: req.user.id,
          conversationId,
          question,
          answer: cached.answer,
          sourcesJson: cached.sources as Prisma.JsonArray,
        },
      });

      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    let stream: NodeJS.ReadableStream;
    try {
      stream = await queryKnowledgeStream({
        question,
        teamId: req.user.teamId,
        conversationId,
      });
    } catch (error) {
      console.error("[query] Failed to start upstream stream", error);

      const fallbackMessage = "AI service is not responding. Try again.";
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      res.write(
        `data: ${JSON.stringify({ type: "token", content: fallbackMessage })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({ type: "done", sources: [] })}\n\n`);

      await prisma.query.create({
        data: {
          teamId: req.user.teamId,
          userId: req.user.id,
          conversationId,
          question,
          answer: fallbackMessage,
          sourcesJson: [] as Prisma.JsonArray,
        },
      });

      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const state: ParsedStreamState = {
      buffer: "",
      assistantContent: "",
      sources: [],
    };

    await new Promise<void>((resolve) => {
      let settled = false;

      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      stream.on("data", (chunk: Buffer | string) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        consumeSseChunk(state, text);
        res.write(text);
      });

      stream.on("end", finish);
      stream.on("error", (error) => {
        console.error("[query] Upstream stream failed", error);

        if (!state.assistantContent.trim()) {
          const fallbackMessage = "AI service is not responding. Try again.";
          state.assistantContent = fallbackMessage;

          if (!res.writableEnded) {
            res.write(
              `data: ${JSON.stringify({ type: "token", content: fallbackMessage })}\n\n`,
            );
          }
        }

        if (!res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({ type: "done", sources: [] })}\n\n`,
          );
        }

        finish();
      });
      req.on("close", () => {
        if ("destroy" in stream && typeof stream.destroy === "function") {
          stream.destroy();
        }

        finish();
      });
    });

    await prisma.query.create({
      data: {
        teamId: req.user.teamId,
        userId: req.user.id,
        conversationId,
        question,
        answer: state.assistantContent,
        sourcesJson: state.sources as Prisma.JsonArray,
      },
    });

    await setCachedQueryAnswer({
      teamId: req.user.teamId,
      question,
      answer: state.assistantContent,
      sources: state.sources,
      ttlSeconds: 3600,
    });

    if (!res.writableEnded) {
      res.end();
    }
  }),
);

router.post(
  "/query/feedback",
  validateBody(feedbackSchema),
  asyncHandler(async (req, res) => {
    if (!req.user?.teamId) {
      throw new ApiError(404, "Not Found", "Team not found");
    }

    const rating =
      req.body.rating === "thumbs_down" || req.body.rating === "down" ? -1 : 1;
    const updated = await prisma.query.updateMany({
      where: {
        id: req.body.queryId,
        teamId: req.user.teamId,
        userId: req.user.id,
      },
      data: {
        rating,
      },
    });

    if (updated.count === 0) {
      throw new ApiError(404, "Not Found", "Query not found");
    }

    res.status(201).json({ success: true });
  }),
);

router.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const where: Prisma.QueryWhereInput = {
      userId: req.user!.id,
      ...(req.user?.teamId ? { teamId: req.user.teamId } : {}),
    };

    const rows = await prisma.query.findMany({
      where,
      orderBy: {
        createdAt: "asc",
      },
    });

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = grouped.get(row.conversationId) ?? [];
      list.push(row);
      grouped.set(row.conversationId, list);
    }

    const conversations = Array.from(grouped.entries())
      .map(([id, items]) => buildConversationFromQueries(id, items))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    res.json(conversations);
  }),
);

router.get(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const conversationId = getParam(req.params.id);
    const where: Prisma.QueryWhereInput = {
      conversationId,
      userId: req.user!.id,
      ...(req.user?.teamId ? { teamId: req.user.teamId } : {}),
    };

    const rows = await prisma.query.findMany({
      where: {
        ...where,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (rows.length === 0) {
      throw new ApiError(404, "Not Found", "Conversation not found");
    }

    res.json(buildConversationFromQueries(conversationId, rows));
  }),
);

router.delete(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const conversationId = getParam(req.params.id);
    const deleted = await prisma.query.deleteMany({
      where: {
        conversationId,
        userId: req.user!.id,
        ...(req.user?.teamId ? { teamId: req.user.teamId } : {}),
      },
    });

    if (deleted.count === 0) {
      throw new ApiError(404, "Not Found", "Conversation not found");
    }

    res.json({ success: true });
  }),
);

export default router;
