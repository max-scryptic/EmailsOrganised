import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  assertSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

/**
 * Request-scoped Supabase client for Server Components, Server Actions, and
 * Route Handlers. Reads and writes the session cookies, so Supabase can rotate
 * the access token on the way through.
 *
 * Cookie writes are wrapped in try/catch because Server Components are not
 * allowed to set cookies. That is fine: Proxy refreshes the session on every
 * request, so the rotated token is written there instead.
 */
export async function createClient() {
  assertSupabaseConfigured();

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component. Proxy handles the refresh.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS, so it must never be constructed in code
 * that can reach the browser and must never be handed a user-supplied filter
 * without an explicit ownership check.
 *
 * Used for the two writes a signed-in user is deliberately not allowed to make
 * themselves: stamping `last_seen_at` and storing Google refresh tokens.
 */
export function createAdminClient() {
  // Supabase now issues `sb_secret_...` keys and treats the JWT-based
  // service_role key as legacy. Either works; neither may be NEXT_PUBLIC_.
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is required for privileged writes. " +
        "See docs/google-sso-setup.md.",
    );
  }

  return createSupabaseClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
