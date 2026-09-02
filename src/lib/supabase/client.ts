"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  assertSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

/**
 * Browser-side Supabase client.
 *
 * Only needed for client components that react to auth state (for example a
 * component that must re-render on sign-out in another tab). The sign-in and
 * sign-out flows themselves are server actions, so the PKCE verifier lives in
 * an httpOnly cookie rather than in browser storage.
 */
export function createClient() {
  assertSupabaseConfigured();

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
