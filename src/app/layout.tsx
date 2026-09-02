import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SessionProvider } from "@/components/session-provider";
import { getSessionUser } from "@/lib/auth/session";
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

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>
          <SessionProvider user={user}>{children}</SessionProvider>
        </Providers>
      </body>
    </html>
  );
}
