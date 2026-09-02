import { ArrowRight, Play, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const pipelineStages = [
  "Classify incoming message",
  "Apply mailbox labels",
  "Draft, file, or escalate",
];

export default function WorkflowsPage() {
  return (
    <AppShell
      title="Workflows"
      description={`Automations for the mailbox routines ${appConfig.name} can run, review, and improve over time.`}
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

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Mailbox workflows</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track the automations currently shaping inbox triage.
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

        <Card>
          <CardHeader>
            <CardTitle>Default pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              The core flow every workflow follows before sending anything.
            </p>
            <CardAction>
              <Badge variant="outline">Review first</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipelineStages.map((stage, index) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary">
                  {index + 1}
                </div>
                <div className="text-sm font-medium">{stage}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
