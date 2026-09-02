import { NextResponse, type NextRequest } from "next/server";
import { GMAIL_SCOPES } from "@/lib/auth/scopes";
import { storeGoogleCredentials } from "@/lib/google/token-store";
import { createClient } from "@/lib/supabase/server";

/**
 * Google redirects here after consent.
 *
 * This is the only moment Supabase exposes `provider_refresh_token`, so the
 * mailbox credentials are captured here or not at all. The user row itself is
 * created by a database trigger on `auth.users`, not by this handler.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  const redirectTo = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=${encodeURIComponent(
        "Google did not return an authorization code.",
      )}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=${encodeURIComponent(
        error?.message ?? "Could not complete sign-in.",
      )}`,
    );
  }

  const { session } = data;

  // Best effort: a failure to store mailbox tokens must not block sign-in. The
  // user lands in the app with gmail_connected_at unset and is prompted to
  // reconnect.
  try {
    await storeGoogleCredentials({
      userId: session.user.id,
      refreshToken: session.provider_refresh_token ?? null,
      accessToken: session.provider_token ?? null,
      // Supabase does not report the provider token's lifetime, so it is stored
      // without an expiry and the first Gmail call refreshes it.
      expiresIn: null,
      scopes: GMAIL_SCOPES,
      googleEmail: session.user.email ?? null,
    });
  } catch (storeError) {
    console.error("Failed to store Google credentials", storeError);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
