import { Download, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CustomerTable } from "@/components/customer-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { appConfig, metrics } from "@/lib/template-data";

const revenueBars = [38, 52, 48, 66, 58, 76, 72, 88, 81, 93, 86, 98];

export default function Home() {
  return (
    <AppShell
      title="Dashboard"
      description={`${appConfig.name} at a glance: revenue, customers, and the actions the team runs most.`}
      actions={
        <>
          <Button type="button" variant="outline">
            <Download className="size-4" />
            Export
          </Button>
          <Button type="button">
            <Plus className="size-4" />
            New customer
          </Button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{metric.value}</div>
              <p className="mt-1 text-xs text-success">{metric.delta}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <p className="text-sm text-muted-foreground">
              Token-driven chart placeholder ready to replace with Recharts.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex h-72 items-end gap-2 rounded-md border bg-muted/30 p-4">
              {revenueBars.map((height, index) => (
                <div
                  key={index}
                  className="flex h-full flex-1 items-end rounded-sm bg-primary/15"
                >
                  <div
                    className="w-full rounded-sm bg-primary"
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Foundations</CardTitle>
            <p className="text-sm text-muted-foreground">
              Baseline product states {appConfig.name} ships with.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              "Semantic light and dark tokens",
              "Responsive app shell",
              "Typed forms with zod validation",
              "Sortable customer table",
              "Empty, loading, and error states",
              "Destructive confirmation hook",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span>{item}</span>
                <span className="text-xs text-success">Ready</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <p className="text-sm text-muted-foreground">
            TanStack Table wired for sorting, filtering, pagination, selection,
            visibility, and row actions.
          </p>
        </CardHeader>
        <CardContent>
          <CustomerTable />
        </CardContent>
      </Card>
    </AppShell>
  );
}
