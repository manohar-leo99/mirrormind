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

  const authCandidates = [
    sessionToken?.githubAccessToken,
    sessionToken?.accessToken,
    sessionToken?.backendAccessToken,
  ].filter((token): token is string => Boolean(token?.trim()));

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

  let upstreamResponse = await fetchWithToken(authCandidates[0]);

  if (
    upstreamResponse.status === 401 &&
    authCandidates.length > 1 &&
    authCandidates[1] !== authCandidates[0]
  ) {
    upstreamResponse = await fetchWithToken(authCandidates[1]);
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
