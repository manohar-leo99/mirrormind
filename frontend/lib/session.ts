import type { Session } from "next-auth";

import { cacheBackendAccessToken } from "@/lib/authTokens";

export type AuthSession = Session & {
  accessToken?: string;
  backendAccessToken?: string;
  backendRefreshToken?: string;
  githubAccessToken?: string;
};

export async function fetchClientSession(): Promise<AuthSession | null> {
  try {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!response.ok) {
      cacheBackendAccessToken(undefined);
      return null;
    }

    const session = (await response.json()) as AuthSession | null;
    if (session?.backendAccessToken) {
      cacheBackendAccessToken(session.backendAccessToken, session.user?.id);
    } else {
      cacheBackendAccessToken(undefined);
    }

    return session && Object.keys(session).length > 0 ? session : null;
  } catch {
    cacheBackendAccessToken(undefined);
    return null;
  }
}
