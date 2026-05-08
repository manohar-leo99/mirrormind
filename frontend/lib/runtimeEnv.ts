function normalizePublicUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

export function ensureAuthRuntimeEnv(): string | undefined {
  const explicitUrl = process.env.NEXTAUTH_URL?.trim();
  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, "");
  }

  const inferredUrl =
    process.env.RAILWAY_STATIC_URL?.trim() ??
    process.env.RAILWAY_PUBLIC_DOMAIN?.trim() ??
    process.env.VERCEL_URL?.trim();

  if (!inferredUrl) {
    if (process.env.NODE_ENV !== "production") {
      return undefined;
    }

    return undefined;
  }

  const resolvedUrl = normalizePublicUrl(inferredUrl);
  process.env.NEXTAUTH_URL = resolvedUrl;
  process.env.NEXTAUTH_URL_INTERNAL = resolvedUrl;
  process.env.AUTH_TRUST_HOST = "true";

  return resolvedUrl;
}
