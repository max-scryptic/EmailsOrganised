import { Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/forms/google-sign-in-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signInWithGoogle } from "@/lib/auth/actions";
import { legalRoutes } from "@/lib/legal";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { appConfig } from "@/lib/template-data";

export type AuthMode = "sign-in" | "sign-up";

/**
 * Sign-in and sign-up run the exact same Google OAuth call — with a single
 * provider and no password flows there is nothing to branch on server-side.
 * They stay two routes because visitors look for two different words, so the
 * only real difference is copy plus the consent notice, which belongs on the
 * screen where an account is created.
 */
const modeCopy: Record<
  AuthMode,
  {
    title: string;
    description: string;
    action: string;
    swapPrompt: string;
    swapLabel: string;
    swapHref: string;
    showConsent: boolean;
  }
> = {
  "sign-in": {
    title: `Sign in to ${appConfig.name}`,
    description:
      "One account, one sign-in. Your Google account both identifies you and connects the mailbox we organise.",
    action: "Continue with Google",
    swapPrompt: `New to ${appConfig.name}?`,
    swapLabel: "Create an account",
    swapHref: "/auth/sign-up",
    showConsent: false,
  },
  "sign-up": {
    title: `Create your ${appConfig.name} account`,
    description:
      "Sign up with the Google account whose mailbox you want organised. That same account is how you sign in from then on.",
    action: "Sign up with Google",
    swapPrompt: "Already have an account?",
    swapLabel: "Sign in",
    swapHref: "/auth/sign-in",
    showConsent: true,
  },
};

export function AuthCard({ mode, next }: { mode: AuthMode; next: string }) {
  const copy = modeCopy[mode];

  // Carry the post-auth destination across the swap so a visitor who was sent
  // here from a deep link still lands there after taking the other route.
  const swapHref =
    next === "/"
      ? copy.swapHref
      : `${copy.swapHref}?next=${encodeURIComponent(next)}`;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <CardTitle>{copy.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
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

        <div className="space-y-3">
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <GoogleSignInButton label={copy.action} />
          </form>

          {copy.showConsent ? (
            <p className="text-center text-xs leading-5 text-muted-foreground">
              By continuing, you agree to the{" "}
              <Link
                href={legalRoutes.terms}
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                Terms and Conditions
              </Link>{" "}
              and the{" "}
              <Link
                href={legalRoutes.privacy}
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                Privacy Policy
              </Link>
              .
            </p>
          ) : null}
        </div>

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

        <Separator />

        <div className="flex flex-wrap items-center justify-center gap-1 text-sm text-muted-foreground">
          <span>{copy.swapPrompt}</span>
          <Button asChild variant="link" size="sm" className="px-1">
            <Link href={swapHref}>{copy.swapLabel}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
