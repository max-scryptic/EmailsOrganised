import { RotateCcw, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sign-in failed",
};

export default async function AuthCodeErrorPage({
  searchParams,
}: PageProps<"/auth/auth-code-error">) {
  const params = await searchParams;
  const reason = typeof params.reason === "string" ? params.reason : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>We could not sign you in</CardTitle>
        <p className="text-sm text-muted-foreground">
          The Google sign-in did not complete. Nothing was changed on your
          account.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>What went wrong</AlertTitle>
          <AlertDescription>
            {reason ?? "Google returned an unexpected response."}
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/auth/sign-in">
            <RotateCcw className="size-4" />
            Try again
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
