import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Storage and refresh for Google mailbox tokens.
 *
 * Supabase hands back `provider_token` and `provider_refresh_token` exactly
 * once — in the session returned by `exchangeCodeForSession`. It does not
 * persist them and will not return them again on later reads, so if the
 * callback does not capture the refresh token here, the only way to recover it
 * is to send the user back through consent.
 *
 * The tokens live in `public.google_credentials`, which has RLS enabled with no
 * policies and no grants to `anon`/`authenticated`. Only the service role
 * reaches it, and only through this module.
 */

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Refresh a little early so an in-flight Gmail call cannot race the expiry. */
const EXPIRY_SKEW_MS = 60_000;

export type StoreCredentialsInput = {
  userId: string;
  refreshToken: string | null;
  accessToken: string | null;
  /** Seconds until the access token expires, as reported by Google. */
  expiresIn?: number | null;
  scopes: string[];
  googleEmail?: string | null;
};

function googleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required to refresh " +
        "mailbox tokens. See docs/google-sso-setup.md.",
    );
  }

  return { clientId, clientSecret };
}

/**
 * Persists the credentials returned by a completed OAuth exchange.
 *
 * A missing refresh token is not an error: Google omits it when the user has
 * already consented and `prompt=consent` was not sent. In that case we keep the
 * refresh token we already hold and only update the access token.
 */
export async function storeGoogleCredentials({
  userId,
  refreshToken,
  accessToken,
  expiresIn,
  scopes,
  googleEmail,
}: StoreCredentialsInput) {
  const admin = createAdminClient();

  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  const { data: existing } = await admin
    .from("google_credentials")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  const effectiveRefreshToken = refreshToken ?? existing?.refresh_token ?? null;

  if (!effectiveRefreshToken) {
    // Nothing durable to store. The user is signed in but the mailbox is not
    // connected; the UI surfaces a reconnect prompt off `gmail_connected_at`.
    return { connected: false as const };
  }

  const { error } = await admin.from("google_credentials").upsert(
    {
      user_id: userId,
      refresh_token: effectiveRefreshToken,
      access_token: accessToken,
      access_token_expires_at: expiresAt,
      scopes,
      google_email: googleEmail ?? null,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Could not store Google credentials: ${error.message}`);
  }

  await admin
    .from("users")
    .update({
      gmail_connected_at: new Date().toISOString(),
      gmail_scopes: scopes,
    })
    .eq("id", userId);

  return { connected: true as const };
}

/**
 * Returns a valid Google access token for a user, refreshing it if needed.
 *
 * Returns null when the mailbox is not connected or Google has revoked the
 * grant — callers should route the user back through consent rather than retry.
 */
export async function getGoogleAccessToken(
  userId: string,
): Promise<string | null> {
  const admin = createAdminClient();

  const { data: credentials } = await admin
    .from("google_credentials")
    .select("refresh_token, access_token, access_token_expires_at, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!credentials || credentials.revoked_at) {
    return null;
  }

  const expiresAt = credentials.access_token_expires_at
    ? Date.parse(credentials.access_token_expires_at)
    : 0;

  if (credentials.access_token && expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return credentials.access_token;
  }

  const { clientId, clientSecret } = googleOAuthClient();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    // invalid_grant means the user revoked access, changed their password, or
    // the token aged out under an unverified ("Testing") OAuth app.
    await markRevoked(userId);
    return null;
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  await admin
    .from("google_credentials")
    .update({
      access_token: payload.access_token,
      access_token_expires_at: new Date(
        Date.now() + payload.expires_in * 1000,
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return payload.access_token;
}

async function markRevoked(userId: string) {
  const admin = createAdminClient();

  await admin
    .from("google_credentials")
    .update({ revoked_at: new Date().toISOString(), access_token: null })
    .eq("user_id", userId);

  await admin
    .from("users")
    .update({ gmail_connected_at: null })
    .eq("id", userId);
}
