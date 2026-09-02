import { Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { GoogleSignInButton } from "@/components/forms/google-sign-in-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signInWithGoogle } from "@/lib/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/auth/sign-in">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle>Sign in to EmailsOrganised</CardTitle>
        <p className="text-sm text-muted-foreground">
          One account, one sign-in. Your Google account both identifies you and
          connects the mailbox we organise.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSupabaseConfigured ? null : (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertTitle>Auth is not configured</AlertTitle>
            <AlertDescription>
              Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
              .env.local, then enable the Google provider in Supabase. See
              docs/google-sso-setup.md.
            </AlertDescription>
          </Alert>
        )}

        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <GoogleSignInButton label="Continue with Google" />
        </form>

        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <span>
              We ask for permission to read, draft, and send mail on your
              behalf. Nothing is sent without you asking for it.
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              We never see your Google password, and you can revoke access at
              any time from your Google account settings.
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
