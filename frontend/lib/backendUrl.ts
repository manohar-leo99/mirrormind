const LOCAL_BACKEND_URL = "http://localhost:4000";

export function getBackendBaseUrl(): string {
  const configuredUrl =
    process.env.BACKEND_URL?.trim() ?? process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_BACKEND_URL;
  }

  throw new Error(
    "BACKEND_URL or NEXT_PUBLIC_API_URL is not configured for the frontend.",
  );
}
