import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { safeNextParam } from "@/lib/auth/next-param";

export const metadata: Metadata = {
  title: "Create an account",
};

export default async function SignUpPage({
  searchParams,
}: PageProps<"/auth/sign-up">) {
  const params = await searchParams;

  return <AuthCard mode="sign-up" next={safeNextParam(params.next)} />;
}
