"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  MailCheck,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TemplateFormField } from "@/components/forms/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authAdapter, type AuthResult } from "@/lib/auth/auth-adapter";

type AuthMode =
  | "sign-in"
  | "sign-up"
  | "forgot-password"
  | "reset-password"
  | "change-password"
  | "verify";

type AuthValues = {
  name: string;
  email: string;
  currentPassword: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
};

const modeCopy = {
  "sign-in": {
    title: "Sign in",
    description: "Create a mock session now, then swap in Supabase Auth.",
    cta: "Sign in",
    hint: "Prepared for supabase.auth.signInWithPassword.",
  },
  "sign-up": {
    title: "Create account",
    description: "Collect the fewest fields needed for email/password signup.",
    cta: "Create account",
    hint: "Prepared for supabase.auth.signUp with an email redirect.",
  },
  "forgot-password": {
    title: "Reset password",
    description: "Request a secure reset link without revealing account state.",
    cta: "Send reset link",
    hint: "Prepared for supabase.auth.resetPasswordForEmail.",
  },
  "reset-password": {
    title: "Choose new password",
    description: "Complete the password update after a recovery link.",
    cta: "Update password",
    hint: "Prepared for supabase.auth.updateUser after recovery.",
  },
  "change-password": {
    title: "Change password",
    description: "Update the password for the active signed-in account.",
    cta: "Save password",
    hint: "Prepared for supabase.auth.updateUser with current_password.",
  },
  verify: {
    title: "Check your inbox",
    description: "Resend verification or magic-link email when needed.",
    cta: "Resend email",
    hint: "Prepared for Supabase resend email flows.",
  },
} satisfies Record<
  AuthMode,
  { title: string; description: string; cta: string; hint: string }
>;

const ctaIcons = {
  "sign-in": ArrowRight,
  "sign-up": UserPlus,
  "forgot-password": MailCheck,
  "reset-password": KeyRound,
  "change-password": KeyRound,
  verify: MailCheck,
} satisfies Record<AuthMode, React.ComponentType<{ className?: string }>>;

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [result, setResult] = useState<
    (AuthResult & { status: "success" | "error" }) | null
  >(null);

  const schema = z
    .object({
      name: z.string(),
      email: z.string(),
      currentPassword: z.string(),
      password: z.string(),
      confirmPassword: z.string(),
      terms: z.boolean(),
    })
    .superRefine((value, context) => {
      const needsEmail = mode !== "reset-password" && mode !== "change-password";
      const needsPassword =
        mode === "sign-in" ||
        mode === "sign-up" ||
        mode === "reset-password" ||
        mode === "change-password";
      const needsConfirmation =
        mode === "sign-up" ||
        mode === "reset-password" ||
        mode === "change-password";

      if (mode === "sign-up" && value.name.trim().length < 2) {
        context.addIssue({
          code: "custom",
          path: ["name"],
          message: "Add your name.",
        });
      }

      if (needsEmail && !z.email().safeParse(value.email).success) {
        context.addIssue({
          code: "custom",
          path: ["email"],
          message: "Enter a valid email address.",
        });
      }

      if (mode === "change-password" && value.currentPassword.length < 8) {
        context.addIssue({
          code: "custom",
          path: ["currentPassword"],
          message: "Enter your current password.",
        });
      }

      if (
        needsPassword &&
        (value.password.length < 8 ||
          !/[a-z]/i.test(value.password) ||
          !/\d/.test(value.password))
      ) {
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: "Use at least 8 characters with a letter and a number.",
        });
      }

      if (needsConfirmation && value.password !== value.confirmPassword) {
        context.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "Passwords must match.",
        });
      }

      if (mode === "sign-up" && !value.terms) {
        context.addIssue({
          code: "custom",
          path: ["terms"],
          message: "Accept the terms to continue.",
        });
      }
    });

  const form = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      currentPassword: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const copy = modeCopy[mode];
  const isVerify = mode === "verify";
  const needsEmail = mode !== "reset-password" && mode !== "change-password";
  const needsPassword =
    mode === "sign-in" ||
    mode === "sign-up" ||
    mode === "reset-password" ||
    mode === "change-password";
  const needsConfirmation =
    mode === "sign-up" || mode === "reset-password" || mode === "change-password";
  const Icon = form.formState.isSubmitting ? Loader2 : ctaIcons[mode];

  async function onSubmit(values: AuthValues) {
    setResult(null);

    try {
      const response = await submitAuthForm(mode, values);
      setResult({ ...response, status: "success" });

      if (mode === "forgot-password" || mode === "verify") {
        form.reset({ ...form.getValues(), password: "", confirmPassword: "" });
      }

      if (mode === "reset-password" || mode === "change-password") {
        form.reset({ ...form.getValues(), currentPassword: "", password: "", confirmPassword: "" });
      }
    } catch (error) {
      setResult({
        status: "error",
        title: "Request failed",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {result ? (
            <Alert variant={result.status === "error" ? "destructive" : "default"}>
              {result.status === "error" ? (
                <TriangleAlert className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              <AlertTitle>{result.title}</AlertTitle>
              <AlertDescription>{result.description}</AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>Mock auth adapter</AlertTitle>
              <AlertDescription>{copy.hint}</AlertDescription>
            </Alert>
          )}
          {mode === "sign-up" ? (
            <TemplateFormField
              label="Name"
              placeholder="Max Winter"
              registration={form.register("name")}
              error={form.formState.errors.name}
            />
          ) : null}
          {needsEmail ? (
            <TemplateFormField
              label="Email"
              type="email"
              placeholder="you@example.com"
              registration={form.register("email")}
              error={form.formState.errors.email}
            />
          ) : null}
          {mode === "change-password" ? (
            <TemplateFormField
              label="Current password"
              type="password"
              registration={form.register("currentPassword")}
              error={form.formState.errors.currentPassword}
            />
          ) : null}
          {needsPassword ? (
            <TemplateFormField
              label={mode === "sign-in" ? "Password" : "New password"}
              type="password"
              registration={form.register("password")}
              error={form.formState.errors.password}
            />
          ) : null}
          {needsConfirmation ? (
            <TemplateFormField
              label="Confirm password"
              type="password"
              registration={form.register("confirmPassword")}
              error={form.formState.errors.confirmPassword}
            />
          ) : null}
          {mode === "sign-up" ? (
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                // eslint-disable-next-line react-hooks/incompatible-library
                checked={form.watch("terms")}
                onCheckedChange={(value) => form.setValue("terms", Boolean(value))}
              />
              <div className="space-y-1">
                <Label htmlFor="terms" className="font-normal">
                  I agree to the terms and privacy policy.
                </Label>
                {form.formState.errors.terms ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.terms.message}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <Button type="submit" className="w-full">
            {copy.cta}
            <Icon
              className={
                form.formState.isSubmitting ? "size-4 animate-spin" : "size-4"
              }
            />
          </Button>
          {!isVerify ? (
            <>
              <Separator />
              <AuthLinks mode={mode} />
            </>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

async function submitAuthForm(mode: AuthMode, values: AuthValues) {
  if (mode === "sign-in") {
    return authAdapter.signIn({
      email: values.email,
      password: values.password,
    });
  }

  if (mode === "sign-up") {
    return authAdapter.signUp({
      name: values.name,
      email: values.email,
      password: values.password,
    });
  }

  if (mode === "forgot-password") {
    return authAdapter.requestPasswordReset({ email: values.email });
  }

  if (mode === "reset-password") {
    return authAdapter.resetPassword({ password: values.password });
  }

  if (mode === "change-password") {
    return authAdapter.changePassword({
      currentPassword: values.currentPassword,
      password: values.password,
    });
  }

  return authAdapter.resendVerification({ email: values.email });
}

function AuthLinks({ mode }: { mode: AuthMode }) {
  if (mode === "sign-in") {
    return (
      <div className="flex justify-between text-sm text-muted-foreground">
        <Link href="/auth/forgot-password" className="hover:text-foreground">
          Forgot password?
        </Link>
        <Link href="/auth/sign-up" className="hover:text-foreground">
          Create account
        </Link>
      </div>
    );
  }

  if (mode === "forgot-password") {
    return (
      <div className="flex justify-between text-sm text-muted-foreground">
        <Link href="/auth/sign-in" className="hover:text-foreground">
          Sign in
        </Link>
        <Link href="/auth/reset-password" className="hover:text-foreground">
          Preview reset
        </Link>
      </div>
    );
  }

  return (
    <div className="flex justify-between text-sm text-muted-foreground">
      <Link href="/auth/sign-in" className="hover:text-foreground">
        Sign in
      </Link>
      <Link href="/auth/sign-up" className="hover:text-foreground">
        Create account
      </Link>
    </div>
  );
}
