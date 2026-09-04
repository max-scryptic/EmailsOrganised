import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig } from "@/lib/template-data";

function ActionSkeletons({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-28" />
      ))}
    </>
  );
}

export function WorkflowsSkeleton() {
  return (
    <AppShell
      title="Workflows"
      description={`The mailbox routines ${appConfig.name} runs for you. Open one to change how it classifies, routes, drafts, and reviews.`}
      actions={<ActionSkeletons count={1} />}
    >
      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-[2fr_0.5fr_0.6fr_48px_48px] gap-4 border-b bg-muted/30 px-4 py-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-[2fr_0.5fr_0.6fr_48px_48px] items-start gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-4 w-24 max-w-full" />
            <Skeleton className="size-4" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}

export function WorkflowDetailSkeleton() {
  return (
    <AppShell
      title="Workflow"
      description="Loading the classifier, classifications, and actions for this workflow."
      breadcrumbs={[{ title: "Workflows", href: "/workflows" }, { title: "Workflow" }]}
      hideHeading
      fill
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-8 w-64 max-w-full" />
          <div className="flex gap-2">
            <ActionSkeletons count={2} />
          </div>
        </div>
        <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
          <div className="relative min-h-0 flex-1 bg-muted/20">
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-24 rounded-full" />
              ))}
            </div>
            <div className="absolute left-1/4 top-1/3 flex items-center gap-6">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-60" />
              ))}
            </div>
            <Skeleton className="absolute bottom-3 right-3 size-11 rounded-full" />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

export function SettingsSkeleton() {
  return (
    <AppShell
      title="Settings"
      description="Reusable profile, billing, and payment settings with predictable save flows."
      actions={<ActionSkeletons count={1} />}
    >
      <div className="space-y-4">
        <div className="grid h-auto grid-cols-2 gap-1 rounded-md bg-muted p-1 md:inline-grid md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full md:w-36" />
          ))}
        </div>
        <Card>
          <CardHeader className="gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <div className="space-y-2 md:col-span-2">
              <Skeleton className="h-4 w-24" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-72 max-w-full" />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-px md:col-span-2" />
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 rounded-md border p-4"
              >
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export function PlansSkeleton() {
  return (
    <AppShell
      title="Manage plans"
      description="Compare tiers, select a plan, and confirm the change before it reaches the billing provider."
    >
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="flex-1">
              <CardHeader className="gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20" />
                  {index === 1 ? <Skeleton className="h-5 w-16" /> : null}
                </div>
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, featureIndex) => (
                    <div key={featureIndex} className="flex items-center gap-2">
                      <Skeleton className="size-4 rounded-full" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-4 rounded-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <Skeleton className="h-9 w-32" />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export function AuthCardSkeleton() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mx-auto h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex items-center justify-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

export function LegalDocumentSkeleton() {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
        </div>
      </header>
      <div className="rounded-md border p-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
      <div className="space-y-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <section key={index} className="space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </section>
        ))}
      </div>
    </article>
  );
}
