import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase session for an incoming request and returns both the
 * user and a response carrying any rotated auth cookies.
 *
 * Server Components cannot set cookies, so this is the one place the rotated
 * access token gets written back to the browser. The returned response must be
 * the one Proxy returns (or its cookies copied onto a redirect) or the session
 * silently expires.
 */
export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token with Supabase. Do not swap this for
  // getSession(), which trusts whatever cookie the browser sent.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response };
}

/** Copies auth cookies from a `next()` response onto a redirect response. */
export function withAuthCookies(
  source: NextResponse,
  destination: NextResponse,
) {
  for (const cookie of source.cookies.getAll()) {
    destination.cookies.set(cookie);
  }

  return destination;
}
