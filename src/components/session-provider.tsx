"use client";

import { createContext, useContext } from "react";
import type { AppUser } from "@/lib/auth/session";

/**
 * Makes the signed-in user available to client components without prop-drilling
 * it through every page into the app shell. The value is resolved on the server
 * in the root layout, so this carries no fetching of its own.
 *
 * This is presentation only. Never gate access on it — authorization lives in
 * `src/lib/auth/session.ts`, on the server.
 */
const SessionContext = createContext<AppUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: AppUser | null;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}

export function useSessionUser() {
  return useContext(SessionContext);
}
