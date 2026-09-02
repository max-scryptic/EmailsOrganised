import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { legalRoutes } from "@/lib/legal";

export default function LegalLayout({ children }: LayoutProps<"/legal">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 md:py-16">
      {/* Not a link, for the same reason as the auth layout: "/" bounces a
          signed-out visitor, and most readers arrive here signed out. */}
      <BrandLockup />

      {children}

      <div className="space-y-4">
        <Separator />
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Button asChild variant="link" size="sm" className="px-1">
            <Link href={legalRoutes.terms}>Terms and Conditions</Link>
          </Button>
          <Button asChild variant="link" size="sm" className="px-1">
            <Link href={legalRoutes.privacy}>Privacy Policy</Link>
          </Button>
          <Button asChild variant="link" size="sm" className="px-1">
            <Link href="/auth/sign-in">Sign in</Link>
          </Button>
        </nav>
      </div>
    </main>
  );
}
