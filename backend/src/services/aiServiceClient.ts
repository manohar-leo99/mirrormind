import axios from "axios";

import { ApiError } from "../lib/httpError";

const aiService = axios.create({
  baseURL: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  timeout: 120000,
});

export async function startIngestion(payload: {
  repoUrl: string;
  teamId: string;
  githubToken: string;
}): Promise<{ jobId: string }> {
  try {
    const { data } = await aiService.post<{ jobId: string }>(
      "/ingest",
      payload,
    );
    return data;
  } catch {
    throw new ApiError(
      503,
      "Service Unavailable",
      "AI service is not responding. Try again.",
    );
  }
}

export async function getIngestionStatus(jobId: string): Promise<{
  status: string;
  itemsProcessed: number;
  totalItems: number;
}> {
  try {
    const { data } = await aiService.get<{
      status: string;
      itemsProcessed: number;
      totalItems: number;
    }>(`/ingest/status/${jobId}`);
    return data;
  } catch {
    throw new ApiError(
      503,
      "Service Unavailable",
      "AI service is not responding. Try again.",
    );
  }
}

export async function reviewPR(payload: {
  prDiff: string;
  prTitle: string;
  teamId: string;
}): Promise<{
  summary: string;
  issues: Array<{ severity: string; description: string; suggestion?: string }>;
}> {
  try {
    const { data } = await aiService.post<{
      summary: string;
      issues: Array<{
        severity: string;
        description: string;
        suggestion?: string;
      }>;
    }>("/review", payload);
    return data;
  } catch {
    throw new ApiError(
      503,
      "Service Unavailable",
      "AI service is not responding. Try again.",
    );
  }
}

export async function queryKnowledgeStream(payload: {
  question: string;
  teamId: string;
  conversationId: string;
}) {
  try {
    const response = await aiService.post("/query", payload, {
      responseType: "stream",
      headers: {
        Accept: "text/event-stream",
      },
      timeout: 0,
    });

    return response.data as NodeJS.ReadableStream;
  } catch {
    throw new ApiError(
      503,
      "Service Unavailable",
      "AI service is not responding. Try again.",
    );
  }
}
