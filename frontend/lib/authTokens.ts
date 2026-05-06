import type { AuthSession } from "@/lib/session";

const AUTH_API_BASE_URL = "/api/backend";

let cachedBackendAccessToken: string | undefined;

function normalizeToken(token?: string | null): string | undefined {
  const trimmed = token?.trim();
  return trimmed ? trimmed : undefined;
}

export function cacheBackendAccessToken(token?: string | null) {
  cachedBackendAccessToken = normalizeToken(token);
}

export function getCachedBackendAccessToken() {
  return cachedBackendAccessToken;
}

export function getPrimaryAuthToken(session: AuthSession | null) {
  return (
    getCachedBackendAccessToken() ??
    normalizeToken(session?.accessToken) ??
    normalizeToken(session?.backendAccessToken) ??
    normalizeToken(session?.githubAccessToken)
  );
}

export function getFallbackAuthToken(
  session: AuthSession | null,
  primaryToken?: string,
) {
  const orderedTokens = [
    normalizeToken(session?.accessToken),
    normalizeToken(session?.backendAccessToken),
    normalizeToken(session?.githubAccessToken),
    getCachedBackendAccessToken(),
  ].filter((token): token is string => Boolean(token));

  for (const token of orderedTokens) {
    if (token !== primaryToken) {
      return token;
    }
  }

  return undefined;
}

export async function refreshBackendAccessToken(refreshToken?: string) {
  const token = normalizeToken(refreshToken);
  if (!token) {
    return undefined;
  }

  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: token }),
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as { accessToken?: string };
    const accessToken = normalizeToken(payload.accessToken);

    if (accessToken) {
      cacheBackendAccessToken(accessToken);
    }

    return accessToken;
  } catch {
    return undefined;
  }
}
