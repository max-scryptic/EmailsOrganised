import "server-only";

import { headers } from "next/headers";

/**
 * Absolute origin for OAuth redirects and Stripe return URLs.
 *
 * Prefers NEXT_PUBLIC_APP_URL so production always sends Google a URL that is
 * registered in the Google Cloud console. Falls back to the forwarded host so
 * local development and preview deployments work without extra configuration.
 */
export async function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (configured) {
    return configured;
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}
