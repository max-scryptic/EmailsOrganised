"use server";

import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { safeNextParam } from "@/lib/auth/next-param";
import { GOOGLE_SCOPE_STRING } from "@/lib/auth/scopes";
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect("/auth/sign-in");
}
