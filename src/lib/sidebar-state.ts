/**
 * Shared between the server (which reads the cookie once per document request)
 * and the sidebar primitive (which writes it on every toggle), so the collapsed
 * state survives a full reload as well as client-side navigation.
 */
export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_DEFAULT_OPEN = true;

export function parseSidebarCookie(value: string | undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return SIDEBAR_DEFAULT_OPEN;
}
