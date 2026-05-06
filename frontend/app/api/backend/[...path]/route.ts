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

  const sessionToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const authToken =
    sessionToken?.backendAccessToken ??
    sessionToken?.accessToken ??
    sessionToken?.githubAccessToken;

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstreamResponse = await fetch(targetUrl, init);

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
