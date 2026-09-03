"use client";

import * as React from "react";
import {
  Archive,
  ArrowDown,
  ArrowRight,
  Filter,
  Forward,
  GitBranch,
  Inbox,
  MailCheck,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
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
import { Separator } from "@/components/ui/separator";
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
import {
  actionLabels,
  createWorkflowAction,
  type WorkflowAction,
  type WorkflowActionType,
  type WorkflowDraft,
  type WorkflowOutcome,
} from "@/lib/workflow-data";

const actionIcons = {
  forward: Forward,
  draft_reply: MailCheck,
  apply_label: Tag,
  archive: Archive,
} satisfies Record<
  WorkflowActionType,
  React.ComponentType<{ className?: string }>
>;

const actionTypes = Object.keys(actionLabels) as WorkflowActionType[];

type SelectedModule =
  | { type: "workflow" }
  | { type: "trigger" }
  | { type: "classifier" }
  | { type: "outcome"; outcomeId: string }
  | { type: "action"; outcomeId: string; actionId: string };

type WorkflowBuilderProps = {
  initialDraft: WorkflowDraft;
  /** "new" starts from a blank draft and asks for a name before saving. */
  mode?: "edit" | "new";
};

export function WorkflowBuilder({
  initialDraft,
  mode = "edit",
}: WorkflowBuilderProps) {
  const [workflowName, setWorkflowName] = React.useState(initialDraft.name);
  const [detail, setDetail] = React.useState(initialDraft.detail);
  const [ownerRole, setOwnerRole] = React.useState(initialDraft.ownerRole);
  const [trigger, setTrigger] = React.useState(initialDraft.trigger);
  const [classifierPrompt, setClassifierPrompt] = React.useState(
    initialDraft.classifierPrompt
  );
  const [outcomes, setOutcomes] = React.useState(initialDraft.outcomes);
  const [selectedModule, setSelectedModule] = React.useState<SelectedModule>({
    type: "workflow",
  });
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);

  const selectedOutcome =
    "outcomeId" in selectedModule
      ? outcomes.find((outcome) => outcome.id === selectedModule.outcomeId)
      : undefined;
  const selectedAction =
    selectedModule.type === "action"
      ? selectedOutcome?.actions.find(
          (action) => action.id === selectedModule.actionId
        )
      : undefined;

  const exampleCount = React.useMemo(
    () =>
      outcomes.reduce(
        (total, outcome) =>
          total +
          outcome.examples
            .split("\n")
            .map((example) => example.trim())
            .filter(Boolean).length,
        0
      ),
    [outcomes]
  );

  const basicsReady = Boolean(workflowName.trim()) && Boolean(detail.trim());
  const actionsReady =
    outcomes.length > 0 &&
    outcomes.every((outcome) => outcome.actions.every(actionIsReady));

  function updateOutcome(
    id: string,
    updater: (outcome: WorkflowOutcome) => WorkflowOutcome
  ) {
    setOutcomes((current) =>
      current.map((outcome) => (outcome.id === id ? updater(outcome) : outcome))
    );
  }

  function addOutcome() {
    const nextOutcome: WorkflowOutcome = {
      id: `outcome-${Date.now()}`,
      name: "New classification",
      description: "",
      examples: "",
      actions: [createWorkflowAction("forward")],
    };

    setOutcomes((current) => [...current, nextOutcome]);
    setSelectedModule({ type: "outcome", outcomeId: nextOutcome.id });
  }

  function addAction(outcomeId: string, type: WorkflowActionType) {
    const nextAction = createWorkflowAction(type);

    updateOutcome(outcomeId, (outcome) => ({
      ...outcome,
      actions: [...outcome.actions, nextAction],
    }));
    setSelectedModule({
      type: "action",
      outcomeId,
      actionId: nextAction.id,
    });
  }

  function updateAction(
    outcomeId: string,
    actionId: string,
    updater: (action: WorkflowAction) => WorkflowAction
  ) {
    updateOutcome(outcomeId, (outcome) => ({
      ...outcome,
      actions: outcome.actions.map((action) =>
        action.id === actionId ? updater(action) : action
      ),
    }));
  }

  function removeAction(outcomeId: string, actionId: string) {
    updateOutcome(outcomeId, (outcome) => ({
      ...outcome,
      actions:
        outcome.actions.length > 1
          ? outcome.actions.filter((action) => action.id !== actionId)
          : outcome.actions,
    }));
    setSelectedModule({ type: "outcome", outcomeId });
  }

  function saveDraft() {
    setLastSavedAt(
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date())
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Flow builder</CardTitle>
            <CardAction>
              <Button
                type="button"
                variant={
                  selectedModule.type === "workflow" ? "default" : "outline"
                }
                onClick={() => setSelectedModule({ type: "workflow" })}
              >
                <Settings2 className="size-4" />
                Settings
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
              <FlowModuleButton
                title="Email arrives"
                detail={trigger}
                icon={Inbox}
                selected={selectedModule.type === "trigger"}
                onClick={() => setSelectedModule({ type: "trigger" })}
                className="max-w-md"
              />
              <FlowConnector label="new email" />
              <FlowModuleButton
                title="Filter incoming email"
                detail={`${outcomes.length} outcomes, ${exampleCount} examples`}
                icon={Filter}
                selected={selectedModule.type === "classifier"}
                onClick={() => setSelectedModule({ type: "classifier" })}
                className="max-w-md"
              />
            </div>

            <div className="flex justify-center">
              <BranchSplit />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">Filter branches</div>
                <Button type="button" variant="outline" onClick={addOutcome}>
                  <Plus className="size-4" />
                  Add branch
                </Button>
              </div>

              {outcomes.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-md border border-dashed px-6 py-10 text-center">
                  <GitBranch className="size-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium">No branches yet</p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      A branch is one thing the filter can decide an email is.
                      Add one, describe the mail it should catch, then choose
                      what happens to it.
                    </p>
                  </div>
                  <Button type="button" onClick={addOutcome}>
                    <Plus className="size-4" />
                    Add first branch
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-3">
                {outcomes.map((outcome) => (
                  <OutcomeBranch
                    key={outcome.id}
                    outcome={outcome}
                    selectedModule={selectedModule}
                    onSelectOutcome={() =>
                      setSelectedModule({
                        type: "outcome",
                        outcomeId: outcome.id,
                      })
                    }
                    onSelectAction={(actionId) =>
                      setSelectedModule({
                        type: "action",
                        outcomeId: outcome.id,
                        actionId,
                      })
                    }
                    onAddAction={(type) => addAction(outcome.id, type)}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ready Check</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <ReadinessRow label="Basics" ready={basicsReady} />
            <ReadinessRow label="Trigger" ready={Boolean(trigger.trim())} />
            <ReadinessRow
              label="Classifier"
              ready={Boolean(classifierPrompt.trim()) && exampleCount > 0}
            />
            <ReadinessRow label="Actions" ready={actionsReady} />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Module settings</CardTitle>
            <CardAction>
              <Badge variant="outline">{moduleLabel(selectedModule)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedModule.type === "workflow" ? (
              <WorkflowSettings
                workflowName={workflowName}
                detail={detail}
                ownerRole={ownerRole}
                onWorkflowNameChange={setWorkflowName}
                onDetailChange={setDetail}
                onOwnerRoleChange={setOwnerRole}
              />
            ) : null}
            {selectedModule.type === "trigger" ? (
              <TriggerSettings trigger={trigger} onTriggerChange={setTrigger} />
            ) : null}
            {selectedModule.type === "classifier" ? (
              <ClassifierSettings
                classifierPrompt={classifierPrompt}
                onClassifierPromptChange={setClassifierPrompt}
              />
            ) : null}
            {selectedModule.type === "outcome" && selectedOutcome ? (
              <OutcomeSettings
                outcome={selectedOutcome}
                onChange={(updater) =>
                  updateOutcome(selectedOutcome.id, updater)
                }
              />
            ) : null}
            {selectedModule.type === "action" &&
            selectedOutcome &&
            selectedAction ? (
              <ActionSettings
                action={selectedAction}
                canRemove={selectedOutcome.actions.length > 1}
                onChange={(updater) =>
                  updateAction(selectedOutcome.id, selectedAction.id, updater)
                }
                onRemove={() =>
                  removeAction(selectedOutcome.id, selectedAction.id)
                }
              />
            ) : null}
            <Separator />
            <Button
              type="button"
              className="w-full"
              disabled={!basicsReady}
              onClick={saveDraft}
            >
              <Save className="size-4" />
              {mode === "new" && !lastSavedAt
                ? "Create workflow"
                : "Save workflow"}
            </Button>
            {!basicsReady ? (
              <p className="text-xs text-muted-foreground">
                Give the workflow a name and a one-line detail in Settings
                before saving it.
              </p>
            ) : lastSavedAt ? (
              <p className="text-xs text-muted-foreground">
                Draft saved at {lastSavedAt}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function OutcomeBranch({
  outcome,
  selectedModule,
  onSelectOutcome,
  onSelectAction,
  onAddAction,
}: {
  outcome: WorkflowOutcome;
  selectedModule: SelectedModule;
  onSelectOutcome: () => void;
  onSelectAction: (actionId: string) => void;
  onAddAction: (type: WorkflowActionType) => void;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <button
        type="button"
        onClick={onSelectOutcome}
        className={cn(
          "flex w-full items-start gap-3 rounded-md border bg-background p-3 text-left transition hover:bg-muted/60",
          selectedModule.type === "outcome" &&
            selectedModule.outcomeId === outcome.id &&
            "border-primary bg-primary/10"
        )}
      >
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{outcome.name}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {outcome.description || "Classification rule"}
          </span>
        </span>
        <Badge variant="secondary">{outcome.actions.length}</Badge>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-3">
        {outcome.actions.map((action, index) => {
          const Icon = actionIcons[action.type];
          const selected =
            selectedModule.type === "action" &&
            selectedModule.outcomeId === outcome.id &&
            selectedModule.actionId === action.id;

          return (
            <React.Fragment key={action.id}>
              {index > 0 ? (
                <ArrowRight className="size-4 text-muted-foreground" />
              ) : null}
              <button
                type="button"
                onClick={() => onSelectAction(action.id)}
                className={cn(
                  "inline-flex h-9 max-w-full items-center gap-2 rounded-md border bg-background px-3 text-sm transition hover:bg-muted/60",
                  selected && "border-primary bg-primary/10"
                )}
              >
                <Icon className="size-4 shrink-0 text-primary" />
                <span className="truncate">{actionSummary(action)}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 pl-3">
        {actionTypes.map((type) => {
          const Icon = actionIcons[type];

          return (
            <Button
              key={type}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddAction(type)}
            >
              <Icon className="size-4" />
              {actionLabels[type]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowSettings({
  workflowName,
  detail,
  ownerRole,
  onWorkflowNameChange,
  onDetailChange,
  onOwnerRoleChange,
}: {
  workflowName: string;
  detail: string;
  ownerRole: string;
  onWorkflowNameChange: (value: string) => void;
  onDetailChange: (value: string) => void;
  onOwnerRoleChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="workflow-name">Name</Label>
        <Input
          id="workflow-name"
          value={workflowName}
          placeholder="CEO inbox triage"
          onChange={(event) => onWorkflowNameChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="workflow-detail">Detail</Label>
        <Textarea
          id="workflow-detail"
          value={detail}
          placeholder="Routes investor, finance, and escalation mail out of the inbox before it needs a read."
          onChange={(event) => onDetailChange(event.target.value)}
          className="min-h-24"
        />
        <p className="text-xs text-muted-foreground">
          One line describing what this workflow does. It is what the workflows
          list shows next to the name.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner-role">Owner</Label>
        <Input
          id="owner-role"
          value={ownerRole}
          placeholder="Everyone"
          onChange={(event) => onOwnerRoleChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function TriggerSettings({
  trigger,
}: {
  trigger: string;
  onTriggerChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="trigger">Trigger</Label>
      <Input id="trigger" value={trigger} disabled readOnly />
      <p className="text-xs text-muted-foreground">
        Every workflow starts from this fixed email event.
      </p>
    </div>
  );
}

function ClassifierSettings({
  classifierPrompt,
  onClassifierPromptChange,
}: {
  classifierPrompt: string;
  onClassifierPromptChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="classifier-prompt">Filter instructions</Label>
      <Textarea
        id="classifier-prompt"
        value={classifierPrompt}
        onChange={(event) => onClassifierPromptChange(event.target.value)}
        className="min-h-36"
      />
    </div>
  );
}

function OutcomeSettings({
  outcome,
  onChange,
}: {
  outcome: WorkflowOutcome;
  onChange: (updater: (outcome: WorkflowOutcome) => WorkflowOutcome) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="outcome-name">Outcome</Label>
        <Input
          id="outcome-name"
          value={outcome.name}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="outcome-description">Classification rule</Label>
        <Textarea
          id="outcome-description"
          value={outcome.description}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          className="min-h-24"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="outcome-examples">Examples</Label>
        <Textarea
          id="outcome-examples"
          value={outcome.examples}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              examples: event.target.value,
            }))
          }
          className="min-h-32"
        />
      </div>
    </div>
  );
}

function ActionSettings({
  action,
  canRemove,
  onChange,
  onRemove,
}: {
  action: WorkflowAction;
  canRemove: boolean;
  onChange: (updater: (action: WorkflowAction) => WorkflowAction) => void;
  onRemove: () => void;
}) {
  const actionId = `selected-${action.id}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select
          value={action.type}
          onValueChange={(value) =>
            onChange((current) => ({
              ...createWorkflowAction(value as WorkflowActionType),
              id: current.id,
              type: value as WorkflowActionType,
              note: current.note,
              signature: current.signature,
            }))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {actionLabels[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label="Remove action"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {action.type === "apply_label" ? (
        <ApplyLabelFields action={action} actionId={actionId} onChange={onChange} />
      ) : null}
      {action.type === "forward" ? (
        <ForwardFields action={action} actionId={actionId} onChange={onChange} />
      ) : null}
      {action.type === "draft_reply" ? (
        <DraftReplyFields action={action} actionId={actionId} onChange={onChange} />
      ) : null}
      {action.type === "archive" ? (
        <ArchiveFields action={action} actionId={actionId} onChange={onChange} />
      ) : null}
    </div>
  );
}

function ApplyLabelFields({ action, actionId, onChange }: ActionFieldProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-label`}>Tag</Label>
        <Input
          id={`${actionId}-label`}
          value={action.labelName}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              labelName: event.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-label-note`}>Note</Label>
        <Input
          id={`${actionId}-label-note`}
          value={action.note}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              note: event.target.value,
            }))
          }
        />
      </div>
    </div>
  );
}

function ForwardFields({ action, actionId, onChange }: ActionFieldProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-forward-to`}>Forward to</Label>
        <Input
          id={`${actionId}-forward-to`}
          type="email"
          value={action.forwardTo}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              forwardTo: event.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-subject-prefix`}>Subject prefix</Label>
        <Input
          id={`${actionId}-subject-prefix`}
          value={action.subjectPrefix}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              subjectPrefix: event.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-forward-note`}>Forward note</Label>
        <Textarea
          id={`${actionId}-forward-note`}
          value={action.note}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              note: event.target.value,
            }))
          }
          className="min-h-24"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-signature`}>Signature</Label>
        <Textarea
          id={`${actionId}-signature`}
          value={action.signature}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              signature: event.target.value,
            }))
          }
          className="min-h-20"
        />
      </div>
      <ActionSwitch
        title="Include thread"
        checked={action.includeOriginalThread}
        onCheckedChange={(checked) =>
          onChange((current) => ({
            ...current,
            includeOriginalThread: checked,
          }))
        }
      />
      <ActionSwitch
        title="Mark handled"
        checked={action.markHandled}
        onCheckedChange={(checked) =>
          onChange((current) => ({
            ...current,
            markHandled: checked,
          }))
        }
      />
    </div>
  );
}

function DraftReplyFields({ action, actionId, onChange }: ActionFieldProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-tone`}>Tone</Label>
        <Input
          id={`${actionId}-tone`}
          value={action.draftTone}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              draftTone: event.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-draft-instructions`}>
          Draft instructions
        </Label>
        <Textarea
          id={`${actionId}-draft-instructions`}
          value={action.draftInstructions}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              draftInstructions: event.target.value,
            }))
          }
          className="min-h-28"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-draft-signature`}>Signature</Label>
        <Textarea
          id={`${actionId}-draft-signature`}
          value={action.signature}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              signature: event.target.value,
            }))
          }
          className="min-h-20"
        />
      </div>
      <ActionSwitch
        title="Require approval"
        checked={action.requireApproval}
        onCheckedChange={(checked) =>
          onChange((current) => ({
            ...current,
            requireApproval: checked,
          }))
        }
      />
    </div>
  );
}

function ArchiveFields({ action, actionId, onChange }: ActionFieldProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-archive-note`}>Archive note</Label>
        <Input
          id={`${actionId}-archive-note`}
          value={action.note}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              note: event.target.value,
            }))
          }
        />
      </div>
      <ActionSwitch
        title="Mark handled"
        checked={action.markHandled}
        onCheckedChange={(checked) =>
          onChange((current) => ({
            ...current,
            markHandled: checked,
          }))
        }
      />
    </div>
  );
}

function FlowModuleButton({
  title,
  detail,
  icon: Icon,
  selected,
  onClick,
  className,
}: {
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-24 w-full items-start gap-3 rounded-md border bg-background p-4 text-left transition hover:bg-muted/60",
        selected && "border-primary bg-primary/10",
        className
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="mt-2 block line-clamp-2 text-sm text-muted-foreground">
          {detail}
        </span>
      </span>
    </button>
  );
}

function FlowConnector({ label }: { label: string }) {
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

function BranchSplit() {
  return (
    <div className="flex h-14 flex-col items-center justify-center">
      <div className="h-5 w-px bg-border" />
      <span className="flex size-8 items-center justify-center rounded-md border bg-background text-primary">
        <GitBranch className="size-4" />
      </span>
      <ArrowDown className="mt-1 size-4 text-muted-foreground" />
    </div>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span>{label}</span>
      <Badge variant={ready ? "outline" : "destructive"}>
        {ready ? "Ready" : "Needs input"}
      </Badge>
    </div>
  );
}

function ActionSwitch({
  title,
  checked,
  onCheckedChange,
}: {
  title: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className="truncate text-sm font-medium">{title}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function moduleLabel(module: SelectedModule) {
  if (module.type === "workflow") {
    return "Workflow";
  }

  if (module.type === "trigger") {
    return "Trigger";
  }

  if (module.type === "classifier") {
    return "Filter";
  }

  if (module.type === "outcome") {
    return "Branch";
  }

  return "Action";
}

function actionSummary(action: WorkflowAction) {
  if (action.type === "apply_label") {
    return action.labelName
      ? `Tag ${action.labelName}`
      : actionLabels.apply_label;
  }

  if (action.type === "forward") {
    return action.forwardTo ? `Forward to ${action.forwardTo}` : actionLabels.forward;
  }

  if (action.type === "draft_reply") {
    return action.draftTone
      ? `Draft reply: ${action.draftTone}`
      : actionLabels.draft_reply;
  }

  return actionLabels.archive;
}

function actionIsReady(action: WorkflowAction) {
  if (action.type === "apply_label") {
    return Boolean(action.labelName.trim());
  }

  if (action.type === "forward") {
    return Boolean(action.forwardTo.trim());
  }

  if (action.type === "draft_reply") {
    return Boolean(action.draftInstructions.trim());
  }

  return true;
}

type ActionFieldProps = {
  action: WorkflowAction;
  actionId: string;
  onChange: (updater: (action: WorkflowAction) => WorkflowAction) => void;
};
