import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { refreshSession, withAuthCookies } from "@/lib/supabase/proxy-session";

/**
 * Proxy (Next.js 16's rename of Middleware) does two jobs here:
 *
 * 1. Refresh the Supabase session on every request so the access token stays
 *    current — Server Components cannot write cookies, so it has to happen here.
 * 2. An optimistic redirect for signed-out visitors. It is optimistic on
 *    purpose: Proxy runs on prefetches too, so it only reads the session and
 *    never queries the database. Real authorization belongs in the Data Access
 *    Layer (`src/lib/auth/session.ts`), which every protected read goes through.
 */

/** Routes reachable while signed out. Everything else requires a session. */
const publicRoutes = [
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/callback",
  "/auth/auth-code-error",
  // The policies are linked from the sign-up consent notice and from Google's
  // OAuth consent screen, so they have to render to a signed-out visitor.
  "/legal",
];

/** The two entry points a signed-in user has no reason to see. */
const authEntryRoutes = ["/auth/sign-in", "/auth/sign-up"];

function isPublicRoute(pathname: string) {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  // With no Supabase env vars the app runs unauthenticated by design, so
  // guarding routes would lock everyone out of a clean checkout.
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const { user, response } = await refreshSession(request);

  if (!user && !isPublicRoute(pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/auth/sign-in";
    signIn.search = "";

    if (pathname !== "/") {
      signIn.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    }

    return withAuthCookies(response, NextResponse.redirect(signIn));
  }

  if (user && authEntryRoutes.includes(pathname)) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";

    return withAuthCookies(response, NextResponse.redirect(home));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Every path except:
     * - Next.js internals and static assets
     * - /api/billing/webhook, which Stripe calls with a signature, not a session
     */
    "/((?!_next/static|_next/image|favicon.ico|api/billing/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
