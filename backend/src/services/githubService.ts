import axios from "axios";

import { ApiError } from "../lib/httpError";

const githubApi = axios.create({
  baseURL: "https://api.github.com",
  timeout: 30000,
  headers: {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
});

export type GitHubProfile = {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
};

export function parseRepoUrl(repoUrl: string): {
  owner: string;
  repo: string;
  repoName: string;
} {
  const normalized = repoUrl.trim().replace(/\.git$/i, "");
  const match = normalized.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
  if (!match) {
    throw new ApiError(
      400,
      "Validation Error",
      "repoUrl must point to github.com",
    );
  }

  const owner = match[1];
  const repo = match[2];
  return {
    owner,
    repo,
    repoName: `${owner}/${repo}`,
  };
}

export async function exchangeCodeForAccessToken(
  code: string,
): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(
      500,
      "Internal Server Error",
      "GitHub OAuth is not configured.",
    );
  }

  const response = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    },
    {
      headers: {
        Accept: "application/json",
      },
      timeout: 30000,
    },
  );

  if (!response.data?.access_token) {
    throw new ApiError(
      401,
      "Unauthorized",
      "Failed to exchange GitHub OAuth code.",
    );
  }

  return response.data.access_token as string;
}

export async function getGitHubProfile(
  accessToken: string,
): Promise<GitHubProfile> {
  const { data } = await githubApi.get<GitHubProfile>("/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!data?.id) {
    throw new ApiError(401, "Unauthorized", "Invalid GitHub access token.");
  }

  if (!data.email) {
    try {
      const emailsResponse = await githubApi.get<
        Array<{ email: string; primary: boolean }>
      >("/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const primary = emailsResponse.data.find((entry) => entry.primary);
      data.email = primary?.email ?? null;
    } catch {
      data.email = null;
    }
  }

  return data;
}

export async function getPullRequestDetails(payload: {
  owner: string;
  repo: string;
  prNumber: number;
  accessToken: string;
}): Promise<{
  title: string;
  author: string;
  prUrl: string;
  diff: string;
}> {
  const { owner, repo, prNumber, accessToken } = payload;

  const prResponse = await githubApi.get(
    `/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const diffResponse = await githubApi.get<string>(
    `/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3.diff",
      },
      responseType: "text",
    },
  );

  return {
    title: prResponse.data.title as string,
    author: (prResponse.data.user?.login as string) ?? "unknown",
    prUrl:
      (prResponse.data.html_url as string) ??
      `https://github.com/${owner}/${repo}/pull/${prNumber}`,
    diff: diffResponse.data,
  };
}

export async function postPullRequestComment(payload: {
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
  accessToken: string;
}): Promise<void> {
  const { owner, repo, prNumber, body, accessToken } = payload;

  await githubApi.post(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    { body },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export async function fetchDiffFromUrl(payload: {
  diffUrl: string;
  accessToken?: string;
}): Promise<string> {
  const { diffUrl, accessToken } = payload;
  const response = await axios.get<string>(diffUrl, {
    headers: {
      Accept: "application/vnd.github.v3.diff",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    responseType: "text",
    timeout: 30000,
  });

  return response.data;
}
