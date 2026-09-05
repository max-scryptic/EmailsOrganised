"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { safeNextParam } from "@/lib/auth/next-param";
import { GOOGLE_SCOPE_STRING } from "@/lib/auth/scopes";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts the Google OAuth flow.
 *
 * Running the exchange server-side keeps the PKCE verifier in an httpOnly
 * cookie. `access_type=offline` with `prompt=consent` is what makes Google
 * return a refresh token — without both, repeat sign-ins return an access token
 * only and background mailbox access breaks the moment the user closes the tab.
 */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNextParam(formData.get("next")?.toString());

  // A clean checkout runs with no Supabase config (see supabase/config.ts), and
  // `createClient` throws there. An uncaught throw in a Server Action reaches
  // the root error boundary, so the whole app would fall over on a button the
  // sign-in card already warns about — say so on the sign-in error page instead.
  if (!isSupabaseConfigured) {
    redirect(
      `/auth/auth-code-error?reason=${encodeURIComponent(
        "Google sign-in is not configured for this deployment yet.",
      )}`,
    );
  }

  const appUrl = await getAppUrl();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: GOOGLE_SCOPE_STRING,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    redirect(
      `/auth/auth-code-error?reason=${encodeURIComponent(
        error?.message ?? "Could not start Google sign-in.",
      )}`,
    );
  }

  redirect(data.url);
}

/**
 * Ends the session and returns the visitor to sign-in.
 *
 * With no Supabase config there is no session to end — the shell is rendering
 * the placeholder user from `getSessionUser` — so logging out is just the
 * redirect. Guarding here matters because `createClient` throws when it is
 * unconfigured, and an uncaught throw in a Server Action takes the whole app to
 * the root error boundary rather than signing anyone out.
 */
export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/auth/sign-in");
}
