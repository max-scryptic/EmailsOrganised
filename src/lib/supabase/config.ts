/**
 * Supabase configuration, read once and shared by every client factory.
 *
 * The app is designed to boot with no environment file (see AGENTS.md), so
 * missing config is a supported state rather than a crash: `isSupabaseConfigured`
 * is false, the sign-in page renders an unconfigured notice, and Proxy stops
 * guarding routes. This mirrors how billing falls back to the mock provider.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Throws with an actionable message instead of a generic Supabase SDK error. */
export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local — see docs/google-sso-setup.md.",
    );
  }
}
