import { LoadingState } from "@/components/states/loading-state";

export default function Loading() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <LoadingState />
      </div>
    </main>
  );
}
