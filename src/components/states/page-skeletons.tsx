import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig } from "@/lib/template-data";

const chartBars = [38, 52, 48, 66, 58, 76, 72, 88, 81, 93, 86, 98];

function ActionSkeletons({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-28" />
      ))}
    </>
  );
}

function MetricCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="gap-2 pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function TableSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-full sm:w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-[48px_1.4fr_0.8fr_0.8fr_0.7fr_48px] gap-4 border-b bg-muted/30 p-4">
          {Array.from({ length: columns + 1 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-[48px_1.4fr_0.8fr_0.8fr_0.7fr_48px] gap-4 border-b p-4 last:border-b-0"
          >
            {Array.from({ length: columns + 1 }).map((_, columnIndex) => (
              <Skeleton
                key={columnIndex}
                className={columnIndex === 1 ? "h-5 w-full" : "h-5 w-3/4"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <AppShell
      title="Dashboard"
      description={`${appConfig.name} at a glance: revenue, customers, and the actions the team runs most.`}
      actions={<ActionSkeletons />}
    >
      <MetricCardsSkeleton />
      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader className="gap-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent>
            <div className="flex h-72 items-end gap-2 rounded-md border bg-muted/30 p-4">
              {chartBars.map((height, index) => (
                <div
                  key={index}
                  className="flex h-full flex-1 items-end rounded-sm bg-muted"
                >
                  <Skeleton
                    className="w-full rounded-sm bg-primary/25"
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader className="gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent>
          <TableSkeleton />
        </CardContent>
      </Card>
    </AppShell>
  );
}

export function WorkflowsSkeleton() {
  return (
    <AppShell
      title="Workflows"
      description={`Automations for the mailbox routines ${appConfig.name} can run, review, and improve over time.`}
      actions={<ActionSkeletons />}
    >
      <MetricCardsSkeleton />
      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="gap-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="divide-y rounded-md border">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-52" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full max-w-2xl" />
                  <div className="flex flex-wrap gap-4">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="gap-2">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-7 shrink-0" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
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
