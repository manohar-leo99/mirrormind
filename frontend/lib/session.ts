import type { Session } from "next-auth";

export type AuthSession = Session & {
  accessToken?: string;
  backendAccessToken?: string;
  githubAccessToken?: string;
};

export async function fetchClientSession(): Promise<AuthSession | null> {
  try {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!response.ok) {
      return null;
    }

    const session = (await response.json()) as AuthSession | null;
    return session && Object.keys(session).length > 0 ? session : null;
  } catch {
    return null;
  }
}