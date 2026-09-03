import { ArrowRight, Play, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { appConfig } from "@/lib/template-data";

const workflowMetrics = [
  { label: "Active workflows", value: "8", detail: "3 handling priority mail" },
  { label: "Emails processed", value: "2,418", detail: "Last 30 days" },
  { label: "Drafts prepared", value: "386", detail: "Awaiting review where needed" },
  { label: "Average response time", value: "14m", detail: "Down from 42m" },
];

const workflows = [
  {
    name: "Customer priority replies",
    description: "Detects paid customer requests, drafts replies, and flags stale threads.",
    trigger: "New inbox message",
    status: "Active",
    volume: "812 processed",
    lastRun: "4 minutes ago",
  },
  {
    name: "Invoice and receipt filing",
    description: "Labels finance mail, extracts vendors, and keeps receipts ready for export.",
    trigger: "Finance sender or attachment",
    status: "Active",
    volume: "284 processed",
    lastRun: "18 minutes ago",
  },
  {
    name: "Newsletter digest",
    description: "Bundles subscriptions into a daily summary without interrupting the inbox.",
    trigger: "Subscribed sender",
    status: "Paused",
    volume: "1,109 processed",
    lastRun: "Yesterday",
  },
];

export default function WorkflowsPage() {
  return (
    <AppShell
      title="Workflows"
      description={`Build modular mailbox automations for the routines ${appConfig.name} can run, review, and improve over time.`}
      actions={
        <>
          <Button type="button" variant="outline">
            <Play className="size-4" />
            Run checks
          </Button>
          <Button type="button">
            <Plus className="size-4" />
            New workflow
          </Button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workflowMetrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{metric.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {metric.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <WorkflowEditor />

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Mailbox workflows</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track the automations already shaping inbox triage.
            </p>
          </CardHeader>
          <CardContent className="divide-y rounded-md border">
            {workflows.map((workflow) => (
              <div
                key={workflow.name}
                className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium">{workflow.name}</h2>
                    <Badge
                      variant={
                        workflow.status === "Active" ? "default" : "secondary"
                      }
                    >
                      {workflow.status}
                    </Badge>
                  </div>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {workflow.description}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{workflow.trigger}</span>
                    <span>{workflow.volume}</span>
                    <span>{workflow.lastRun}</span>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm">
                  Review
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
