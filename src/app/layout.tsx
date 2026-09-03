import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { SessionProvider } from "@/components/session-provider";
import { SidebarStateProvider } from "@/components/sidebar-state-provider";
import { getSessionUser } from "@/lib/auth/session";
import { SIDEBAR_COOKIE_NAME, parseSidebarCookie } from "@/lib/sidebar-state";
import { appConfig } from "@/lib/template-data";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: appConfig.name,
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.description,
  applicationName: appConfig.name,
  openGraph: {
    title: appConfig.name,
    description: appConfig.description,
    siteName: appConfig.name,
    type: "website",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolved once here so client components can read the user from context
  // instead of every page prop-drilling it into the app shell.
  const user = await getSessionUser();

  // Read once here so the first paint matches what the user left the sidebar
  // at, and so the state lives above the per-page app shells that remount on
  // navigation.
  const cookieStore = await cookies();
  const sidebarOpen = parseSidebarCookie(
    cookieStore.get(SIDEBAR_COOKIE_NAME)?.value
  );

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>
          <SessionProvider user={user}>
            <SidebarStateProvider defaultOpen={sidebarOpen}>
              {children}
            </SidebarStateProvider>
          </SessionProvider>
        </Providers>
      </body>
    </html>
  );
}
