import { BrandLockup } from "@/components/brand-logo";

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        {/* Not a link: every in-app route redirects a signed-out visitor back
            here, so linking the lockup to "/" would just bounce them. */}
        <BrandLockup />
        {children}
      </div>
    </main>
  );
}
