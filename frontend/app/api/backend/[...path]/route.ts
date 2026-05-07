import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { getBackendBaseUrl } from "@/lib/backendUrl";

export const runtime = "nodejs";

async function proxyRequest(
  request: NextRequest,
  context: { params: { path?: string[] } },
) {
  const pathSegments = context.params.path ?? [];
  let backendBaseUrl: string;

  try {
    backendBaseUrl = getBackendBaseUrl();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Backend URL is not configured.";

    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  }

  const targetUrl = new URL(
    `/${pathSegments.join("/")}${request.nextUrl.search}`,
    backendBaseUrl,
  );

  const headers = new Headers(request.headers);
  headers.delete("host");

  const requestBody =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : undefined;

  const sessionToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const incomingAuthorization = request.headers.get("authorization")?.trim();

  const authCandidates = [
    sessionToken?.backendAccessToken,
    sessionToken?.accessToken,
    incomingAuthorization?.toLowerCase().startsWith("bearer ")
      ? incomingAuthorization.slice("Bearer ".length).trim()
      : undefined,
    sessionToken?.githubAccessToken,
  ].filter((token): token is string => Boolean(token?.trim()));

  // De-duplicate tokens so we don't retry the same value.
  const uniqueCandidates = [...new Set(authCandidates)];

  const fetchWithToken = async (authToken?: string) => {
    const requestHeaders = new Headers(headers);

    if (authToken) {
      requestHeaders.set("Authorization", `Bearer ${authToken}`);
    } else {
      requestHeaders.delete("authorization");
    }

    const init: RequestInit = {
      method: request.method,
      headers: requestHeaders,
      redirect: "manual",
    };

    if (requestBody) {
      init.body = requestBody;
    }

    return fetch(targetUrl, init);
  };

  const refreshBackendAccessToken = async (refreshToken?: string) => {
    if (!refreshToken?.trim()) {
      return undefined;
    }

    try {
      const refreshResponse = await fetch(
        new URL("/api/auth/refresh", backendBaseUrl),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        },
      );

      if (!refreshResponse.ok) {
        return undefined;
      }

      const payload = (await refreshResponse.json()) as {
        accessToken?: string;
      };

      return payload.accessToken?.trim() || undefined;
    } catch {
      return undefined;
    }
  };

  // Try each unique candidate token until one succeeds.
  let upstreamResponse = await fetchWithToken(uniqueCandidates[0]);

  for (let i = 1; i < uniqueCandidates.length && upstreamResponse.status === 401; i++) {
    upstreamResponse = await fetchWithToken(uniqueCandidates[i]);
  }

  // If all candidates failed, try refreshing the backend access token.
  if (
    upstreamResponse.status === 401 &&
    sessionToken?.backendRefreshToken?.trim()
  ) {
    const refreshedAccessToken = await refreshBackendAccessToken(
      sessionToken.backendRefreshToken,
    );

    if (refreshedAccessToken) {
      upstreamResponse = await fetchWithToken(refreshedAccessToken);
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: upstreamResponse.headers,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { path?: string[] } },
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: { path?: string[] } },
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: { path?: string[] } },
) {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { path?: string[] } },
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: { path?: string[] } },
) {
  return proxyRequest(request, context);
}

export async function HEAD(
  request: NextRequest,
  context: { params: { path?: string[] } },
) {
  return proxyRequest(request, context);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: { path?: string[] } },
) {
  return proxyRequest(request, context);
}
