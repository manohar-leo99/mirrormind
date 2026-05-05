import axios, { AxiosHeaders } from "axios";
import { getSession } from "next-auth/react";

import type {
  IngestionStatusItem,
  PullRequestItem,
  RepoConnection,
  TeamInfo,
  TeamMember,
  Conversation,
} from "@/types/domain";

export const API_BASE_URL = "/api/backend";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const session = await getSession();
  const token = session?.accessToken;
  if (token) {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }

    if (config.headers instanceof AxiosHeaders) {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      (config.headers as Record<string, string>).Authorization =
        `Bearer ${token}`;
    }
  }
  return config;
});

export async function getTeamInfo() {
  const { data } = await api.get<TeamInfo>("/api/team");
  return data;
}

export async function getConnectedRepos() {
  const { data } = await api.get<RepoConnection[]>("/api/repos");
  return data;
}

export async function getIngestionStatus() {
  const { data } = await api.get<IngestionStatusItem[]>(
    "/api/ingestion/status",
  );
  return data;
}

export async function getPullRequests() {
  const { data } = await api.get<PullRequestItem[]>("/api/reviews/prs");
  return data;
}

export async function triggerPRReview(payload: {
  prNumber: number;
  repoName: string;
}) {
  const { data } = await api.post("/api/reviews/trigger", payload);
  return data;
}

export async function getConversations() {
  const { data } = await api.get<Conversation[]>("/api/conversations");
  return data;
}

export async function inviteTeamMember(payload: {
  email: string;
  role: string;
}) {
  const { data } = await api.post("/api/team/invite", payload);
  return data;
}

export async function getTeamMembers() {
  const { data } = await api.get<TeamMember[]>("/api/team/members");
  return data;
}

export async function updateTeamMemberRole(
  userId: string,
  payload: { role: string },
) {
  const { data } = await api.patch(`/api/team/members/${userId}`, payload);
  return data;
}

export async function removeTeamMember(userId: string) {
  const { data } = await api.delete(`/api/team/members/${userId}`);
  return data;
}

export async function connectRepo(payload: { repoUrl: string }) {
  const { data } = await api.post("/api/repos/connect", payload);
  return data;
}

export async function disconnectRepo(repoId: string) {
  const { data } = await api.delete(`/api/repos/${repoId}`);
  return data;
}

export async function syncRepo(repoId: string) {
  const { data } = await api.post(`/api/ingestion/sync/${repoId}`);
  return data;
}

export async function getBillingInfo() {
  const { data } = await api.get("/api/billing");
  return data;
}
