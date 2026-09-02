import { AppBranding } from "@/components/app-branding";

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <AppBranding />
        {children}
      </div>
    </main>
  );
}
