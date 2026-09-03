"use client";

import { useState } from "react";
import {
  Archive,
  Bell,
  Clock,
  FileText,
  Filter,
  Forward,
  GitBranch,
  Mail,
  Play,
  Plus,
  Reply,
  Settings2,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type WorkflowAction = {
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  output: string;
  category: "Mailbox" | "Response" | "Routing";
};

const filterFields = [
  "Sender",
  "Subject",
  "Body",
  "Recipient",
  "Attachment name",
  "Gmail label",
];

const filterOperators = [
  "contains",
  "does not contain",
  "is from",
  "has attachment",
  "matches priority sender",
];

const actionOptions: WorkflowAction[] = [
  {
    id: "tag",
    name: "Tag the email",
    description: "Apply one or more mailbox labels before the thread is triaged.",
    Icon: Tag,
    output: "Adds label: Priority customer",
    category: "Mailbox",
  },
  {
    id: "forward",
    name: "Forward",
    description: "Send the matching message to a teammate or shared inbox.",
    Icon: Forward,
    output: "Forwards to support@company.com",
    category: "Routing",
  },
  {
    id: "draft",
    name: "Draft a reply",
    description: "Prepare a reply for review using the original message context.",
    Icon: Reply,
    output: "Creates draft with approval required",
    category: "Response",
  },
  {
    id: "summary",
    name: "Summarise thread",
    description: "Write a compact summary and add it to the workflow activity log.",
    Icon: FileText,
    output: "Saves summary to the thread timeline",
    category: "Response",
  },
  {
    id: "archive",
    name: "Archive",
    description: "Move low-risk messages out of the inbox after the filter passes.",
    Icon: Archive,
    output: "Archives matching conversations",
    category: "Mailbox",
  },
  {
    id: "notify",
    name: "Notify owner",
    description: "Create an internal notification when a message needs a human.",
    Icon: Bell,
    output: "Alerts assigned inbox owner",
    category: "Routing",
  },
];

const quickStats = [
  { label: "Matched", value: "74%", tone: "bg-success/10 text-success" },
  { label: "Review required", value: "18%", tone: "bg-warning/20 text-warning" },
  { label: "Auto-complete", value: "56%", tone: "bg-primary/10 text-primary" },
];

export function WorkflowEditor() {
  const [field, setField] = useState(filterFields[0]);
  const [operator, setOperator] = useState(filterOperators[0]);
  const [value, setValue] = useState("priority customer");
  const [selectedActionId, setSelectedActionId] = useState(actionOptions[2].id);
  const [reviewFirst, setReviewFirst] = useState(true);

  const selectedAction =
    actionOptions.find((action) => action.id === selectedActionId) ??
    actionOptions[0];

  return (
    <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
      <Card className="xl:sticky xl:top-20 xl:self-start">
        <CardHeader>
          <CardTitle>Node library</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add reusable blocks to the active branch.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <LibraryHeading title="Trigger" />
            <NodeLibraryButton
              title="Email arrives"
              description="The fixed starting event for every workflow."
              Icon={Mail}
              locked
            />
          </div>
          <div className="space-y-2">
            <LibraryHeading title="Logic" />
            <NodeLibraryButton
              title="Filter"
              description="Route messages based on sender, subject, body, or labels."
              Icon={Filter}
              locked
            />
          </div>
          <div className="space-y-2">
            <LibraryHeading title="Actions" />
            {actionOptions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => setSelectedActionId(action.id)}
                aria-pressed={selectedActionId === action.id}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted/70",
                  selectedActionId === action.id &&
                    "border-primary bg-primary/10"
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <action.Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {action.name}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {action.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="min-h-[720px] overflow-hidden rounded-lg border bg-muted/20">
        <div className="flex flex-col gap-3 border-b bg-background/90 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Draft workflow</Badge>
            <span className="text-sm font-medium">Priority inbox triage</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm">
              <Play className="size-4" />
              Test flow
            </Button>
            <Button type="button" size="sm">
              Publish
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="mx-auto flex min-w-[620px] max-w-3xl flex-col items-center px-6 py-8">
            <WorkflowNode
              title="Email arrives"
              eyebrow="Trigger"
              description="Runs whenever a new message lands in the connected inbox."
              Icon={Mail}
              badge="Always first"
              selected
            />
            <Connector label="new message" />
            <WorkflowNode
              title="Filter message"
              eyebrow="Condition"
              description={`${field} ${operator} "${value || "value"}"`}
              Icon={Filter}
              badge="Editable"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                <FieldBlock label="Field">
                  <Select value={field} onValueChange={setField}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterFields.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldBlock>
                <FieldBlock label="Operator">
                  <Select value={operator} onValueChange={setOperator}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOperators.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldBlock>
                <FieldBlock label="Value">
                  <Input
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="priority customer"
                  />
                </FieldBlock>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="w-full">
                    <Plus className="size-4" />
                    Add rule
                  </Button>
                </div>
              </div>
            </WorkflowNode>
            <BranchConnector />
            <WorkflowNode
              title={selectedAction.name}
              eyebrow="Matched action"
              description={selectedAction.description}
              Icon={selectedAction.Icon}
              badge={selectedAction.category}
              selected
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                    Output
                  </div>
                  <div className="mt-1 text-sm">{selectedAction.output}</div>
                </div>
                <Button type="button" variant="outline">
                  <Settings2 className="size-4" />
                  Configure
                </Button>
              </div>
            </WorkflowNode>
            <Connector label="then" />
            <button
              type="button"
              className="flex min-h-20 w-full max-w-md items-center justify-center gap-2 rounded-md border border-dashed bg-background/70 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-foreground"
            >
              <Plus className="size-4" />
              Add next action
            </button>
          </div>
        </div>
      </div>

      <Card className="xl:sticky xl:top-20 xl:self-start">
        <CardHeader>
          <CardTitle>Inspector</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure the selected branch and action.
          </p>
          <CardAction>
            <Badge variant="secondary">Modular</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="review-first">Review before sending</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keep generated replies in draft until approved.
                </p>
              </div>
              <Switch
                id="review-first"
                checked={reviewFirst}
                onCheckedChange={setReviewFirst}
              />
            </div>
            <FieldBlock label="Action notes">
              <Textarea
                placeholder="Describe how this action should behave..."
                defaultValue="Use a concise, helpful tone and preserve the original thread context."
              />
            </FieldBlock>
          </div>

          <div className="grid gap-2">
            {quickStats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between rounded-md border bg-background p-3"
              >
                <span className="text-sm text-muted-foreground">
                  {stat.label}
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-sm font-semibold",
                    stat.tone
                  )}
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4 text-muted-foreground" />
              Last test run
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              16 sample emails checked. 12 matched the filter and would continue
              to the selected action.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function LibraryHeading({ title }: { title: string }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
      {title}
    </div>
  );
}

function NodeLibraryButton({
  title,
  description,
  Icon,
  locked,
}: {
  title: string;
  description: string;
  Icon: LucideIcon;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {locked ? <Badge variant="outline">Locked</Badge> : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function WorkflowNode({
  title,
  eyebrow,
  description,
  Icon,
  badge,
  selected,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  Icon: LucideIcon;
  badge: string;
  selected?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-md rounded-md border bg-background p-4 shadow-sm",
        selected && "border-primary ring-3 ring-primary/20"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              {eyebrow}
            </span>
            <Badge variant={selected ? "default" : "secondary"}>{badge}</Badge>
          </div>
          <h2 className="mt-1 text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex h-16 flex-col items-center justify-center">
      <div className="h-8 w-px bg-border" />
      <span className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
        {label}
      </span>
      <div className="h-8 w-px bg-border" />
    </div>
  );
}

function BranchConnector() {
  return (
    <div className="grid h-24 w-full max-w-md grid-cols-[1fr_auto_1fr] items-center">
      <div className="flex items-center">
        <div className="h-px flex-1 bg-border" />
        <span className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
          otherwise stop
        </span>
      </div>
      <div className="flex h-full flex-col items-center px-3">
        <div className="h-8 w-px bg-border" />
        <span className="flex size-8 items-center justify-center rounded-md border bg-background text-primary">
          <GitBranch className="size-4" />
        </span>
        <div className="h-8 w-px bg-border" />
      </div>
      <div className="flex items-center">
        <span className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
          matches
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
