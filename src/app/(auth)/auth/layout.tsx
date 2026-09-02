import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>
        <Link href="/" className="w-fit">
          <BrandLockup />
        </Link>
        {children}
      </div>
    </main>
  );
}
