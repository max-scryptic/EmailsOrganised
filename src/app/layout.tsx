import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { SessionProvider } from "@/components/session-provider";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EmailsOrganised",
    template: "%s | EmailsOrganised",
  },
  description:
    "Organise your inbox: read, draft, and send from one connected Google account.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
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
