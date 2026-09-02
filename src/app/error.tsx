"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/lib/template-data";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-xl space-y-4">
        <ErrorState
          title="Application error"
          description={`${appConfig.name} hit an unexpected render failure.`}
          onRetry={reset}
        />
        <Button type="button" variant="outline" onClick={() => router.push("/")}>
          Return home
        </Button>
      </div>
    </main>
  );
}
