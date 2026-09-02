import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { currentUser as placeholderUser } from "@/lib/template-data";

/**
 * The Data Access Layer for auth.
 *
 * Every server-side "who is this?" goes through here rather than reading
 * cookies directly, so the Proxy redirect stays an optimistic UX shortcut and
 * this stays the actual authorization boundary.
 */

export type AppUser = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  initials: string;
  /** Whether we hold a usable Google refresh token for this user's mailbox. */
  gmailConnected: boolean;
};

function initialsFrom(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * Returns the signed-in user, or null when signed out.
 *
 * `cache` dedupes this across a render pass, so a layout, a page, and a leaf
 * component can each ask independently without extra round trips.
 */
export const getSessionUser = cache(async (): Promise<AppUser | null> => {
  // No Supabase configured: the app runs in its template state, where the
  // placeholder user keeps the shell rendering on a clean checkout.
  if (!isSupabaseConfigured) {
    return {
      id: "template-user",
      email: placeholderUser.email,
      name: placeholderUser.name,
      avatar: placeholderUser.avatar,
      initials: placeholderUser.initials,
      gmailConnected: false,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // RLS limits this to the caller's own row, so no ownership filter is needed
  // beyond the one the policy enforces.
  const { data: profile } = await supabase
    .from("users")
    .select("email, full_name, avatar_url, gmail_connected_at")
    .eq("id", user.id)
    .maybeSingle();

  const email = profile?.email ?? user.email ?? "";
  const name =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    email;

  return {
    id: user.id,
    email,
    name,
    avatar:
      profile?.avatar_url ??
      (user.user_metadata?.avatar_url as string | undefined) ??
      "",
    initials: initialsFrom(name, email),
    gmailConnected: Boolean(profile?.gmail_connected_at),
  };
});

/**
 * Same as `getSessionUser`, but redirects to sign-in instead of returning null.
 * Use this in any Server Component, Server Action, or Route Handler that reads
 * or writes user-owned data.
 */
export async function requireUser(): Promise<AppUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return user;
}
