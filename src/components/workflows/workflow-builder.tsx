"use client";

import * as React from "react";
import {
  Archive,
  CheckCircle2,
  CircleDot,
  Filter,
  Forward,
  GitBranch,
  Grip,
  Inbox,
  Loader2,
  MailCheck,
  MousePointer2,
  Move,
  Save,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { saveWorkflow } from "@/app/workflows/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  type WorkflowStatus,
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

const canvasWidth = 1520;
const canvasHeight = 980;
const nodeWidth = 248;
const nodeHeights = {
  trigger: 112,
  classifier: 112,
  outcome: 124,
  action: 104,
} satisfies Record<CanvasNodeKind, number>;

type CanvasNodeKind = "trigger" | "classifier" | "outcome" | "action";

type CanvasNodePosition = {
  x: number;
  y: number;
};

type CanvasPositions = Record<string, CanvasNodePosition>;

type FlowCanvasNode = {
  id: string;
  kind: CanvasNodeKind;
  module: Exclude<SelectedModule, { type: "workflow" }>;
  title: string;
  detail: string;
  meta: string;
  icon: React.ComponentType<{ className?: string }>;
  position: CanvasNodePosition;
  ready: boolean;
  outcomeId?: string;
  actionId?: string;
};

type CanvasEdge = {
  from: string;
  to: string;
};

type PaletteWidgetType = "outcome" | WorkflowActionType;

type DragState =
  | {
      type: "pan";
      startClientX: number;
      startClientY: number;
      startPan: CanvasNodePosition;
    }
  | {
      type: "node";
      nodeId: string;
      startClientX: number;
      startClientY: number;
      startPosition: CanvasNodePosition;
      nodeKind: CanvasNodeKind;
      element: HTMLDivElement;
      frame: number;
      nextPosition: CanvasNodePosition;
    };

type SelectedModule =
  | { type: "workflow" }
  | { type: "trigger" }
  | { type: "classifier" }
  | { type: "outcome"; outcomeId: string }
  | { type: "action"; outcomeId: string; actionId: string };

type WorkflowBuilderProps = {
  initialDraft: WorkflowDraft;
  workflowId?: string;
  status?: WorkflowStatus;
  /** "new" starts from a blank draft and asks for a name before saving. */
  mode?: "edit" | "new";
};

type WorkflowResult =
  | {
      status: "success" | "error";
      title: string;
      description: string;
    }
  | null;

export function WorkflowBuilder({
  initialDraft,
  workflowId,
  status = "draft",
  mode = "edit",
}: WorkflowBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef<DragState | null>(null);
  const [workflowName, setWorkflowName] = React.useState(initialDraft.name);
  const [detail, setDetail] = React.useState(initialDraft.detail);
  const [ownerRole, setOwnerRole] = React.useState(initialDraft.ownerRole);
  const [trigger, setTrigger] = React.useState(initialDraft.trigger);
  const [classifierPrompt, setClassifierPrompt] = React.useState(
    initialDraft.classifierPrompt
  );
  const [outcomes, setOutcomes] = React.useState(initialDraft.outcomes);
  const [nodePositions, setNodePositions] = React.useState<CanvasPositions>(
    () => createInitialNodePositions(initialDraft.outcomes)
  );
  const [pan, setPan] = React.useState<CanvasNodePosition>({ x: 8, y: 8 });
  const [connectingFrom, setConnectingFrom] =
    React.useState<FlowCanvasNode | null>(null);
  const [selectedModule, setSelectedModule] = React.useState<SelectedModule>({
    type: "workflow",
  });
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const showWorkflowGraph =
    mode === "edit" || outcomes.length > 0 || Boolean(classifierPrompt.trim());
  const [result, setResult] = React.useState<WorkflowResult>(null);

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

  const canvasNodes = React.useMemo(
    () =>
      createCanvasNodes({
        trigger,
        classifierPrompt,
        outcomes,
        exampleCount,
        nodePositions,
        showWorkflowGraph,
      }),
    [
      classifierPrompt,
      exampleCount,
      nodePositions,
      outcomes,
      showWorkflowGraph,
      trigger,
    ]
  );
  const canvasNodeMap = React.useMemo(
    () => new Map(canvasNodes.map((node) => [node.id, node])),
    [canvasNodes]
  );
  const canvasEdges = React.useMemo(
    () => createCanvasEdges(outcomes, showWorkflowGraph),
    [outcomes, showWorkflowGraph]
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

  function addOutcome(position?: CanvasNodePosition) {
    const nextIndex = outcomes.length;
    const nextOutcome: WorkflowOutcome = {
      id: `outcome-${Date.now()}`,
      name: "New classification",
      description: "",
      examples: "",
      actions: [createWorkflowAction("forward")],
    };
    const outcomePosition = clampCanvasPosition(
      position ?? {
        x: 640,
        y: 96 + nextIndex * 176,
      },
      "outcome"
    );
    const actionPosition = clampCanvasPosition(
      {
        x: outcomePosition.x + 330,
        y: outcomePosition.y + 10,
      },
      "action"
    );
    const firstAction = nextOutcome.actions[0];

    setNodePositions((current) => ({
      ...current,
      [nextOutcome.id]: outcomePosition,
      [firstAction.id]: actionPosition,
    }));
    setOutcomes((current) => [...current, nextOutcome]);
    setSelectedModule({ type: "outcome", outcomeId: nextOutcome.id });
  }

  function addAction(
    outcomeId: string,
    type: WorkflowActionType,
    position?: CanvasNodePosition
  ) {
    const nextAction = createWorkflowAction(type);
    const outcome = outcomes.find((current) => current.id === outcomeId);
    const outcomePosition = nodePositions[outcomeId] ?? { x: 640, y: 96 };
    const actionPosition = clampCanvasPosition(
      position ?? {
        x: outcomePosition.x + 330 + (outcome?.actions.length ?? 0) * 286,
        y: outcomePosition.y + 10,
      },
      "action"
    );

    setNodePositions((current) => ({
      ...current,
      [nextAction.id]: actionPosition,
    }));
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
    setNodePositions((current) => {
      const next = { ...current };
      delete next[actionId];
      return next;
    });
    setSelectedModule({ type: "outcome", outcomeId });
  }

  function currentDraft(): WorkflowDraft {
    return {
      name: workflowName,
      detail,
      ownerRole,
      trigger,
      classifierPrompt,
      outcomes,
    };
  }

  function moveActionToOutcome(actionId: string, outcomeId: string) {
    let movedAction: WorkflowAction | undefined;

    setOutcomes((current) => {
      const next = current.map((outcome) => {
        const action = outcome.actions.find((item) => item.id === actionId);

        if (!action) {
          return outcome;
        }

        movedAction = action;
        return {
          ...outcome,
          actions: outcome.actions.filter((item) => item.id !== actionId),
        };
      });

      if (!movedAction) {
        return current;
      }

      const actionToMove = movedAction;

      return next.map((outcome) =>
        outcome.id === outcomeId &&
        !outcome.actions.some((action) => action.id === actionId)
          ? { ...outcome, actions: [...outcome.actions, actionToMove] }
          : outcome
      );
    });
    setSelectedModule({ type: "action", outcomeId, actionId });
  }

  function reorderActionAfter(sourceActionId: string, targetActionId: string) {
    setOutcomes((current) =>
      current.map((outcome) => {
        const sourceIndex = outcome.actions.findIndex(
          (action) => action.id === sourceActionId
        );
        const targetIndex = outcome.actions.findIndex(
          (action) => action.id === targetActionId
        );

        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
          return outcome;
        }

        const nextActions = [...outcome.actions];
        const [targetAction] = nextActions.splice(targetIndex, 1);
        const nextSourceIndex = nextActions.findIndex(
          (action) => action.id === sourceActionId
        );
        nextActions.splice(nextSourceIndex + 1, 0, targetAction);

        return { ...outcome, actions: nextActions };
      })
    );
  }

  function getCanvasPoint(clientX: number, clientY: number) {
    const bounds = canvasRef.current?.getBoundingClientRect();

    if (!bounds) {
      return { x: 0, y: 0 };
    }

    return {
      x: clientX - bounds.left - pan.x,
      y: clientY - bounds.top - pan.y,
    };
  }

  function selectedOutcomeIdForWidgetDrop(point: CanvasNodePosition) {
    const nearestOutcome = outcomes
      .map((outcome) => ({
        outcome,
        position: nodePositions[outcome.id] ?? { x: 640, y: 96 },
      }))
      .map(({ outcome, position }) => ({
        outcome,
        distance: Math.hypot(point.x - position.x, point.y - position.y),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearestOutcome && nearestOutcome.distance < 360) {
      return nearestOutcome.outcome.id;
    }

    if ("outcomeId" in selectedModule) {
      return selectedModule.outcomeId;
    }

    return outcomes[0]?.id;
  }

  function handleWidgetDrop(widgetType: PaletteWidgetType, point: CanvasNodePosition) {
    const position = {
      x: point.x - nodeWidth / 2,
      y: point.y - nodeHeights[widgetType === "outcome" ? "outcome" : "action"] / 2,
    };

    if (widgetType === "outcome") {
      addOutcome(position);
      return;
    }

    const outcomeId = selectedOutcomeIdForWidgetDrop(point);

    if (outcomeId) {
      addAction(outcomeId, widgetType, position);
    }
  }

  function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const widgetType = event.dataTransfer.getData(
      "application/x-workflow-widget"
    ) as PaletteWidgetType;

    if (!isPaletteWidgetType(widgetType)) {
      return;
    }

    handleWidgetDrop(widgetType, getCanvasPoint(event.clientX, event.clientY));
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      type: "pan",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: pan,
    };
    setConnectingFrom(null);
  }

  function handleNodePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    node: FlowCanvasNode
  ) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      type: "node",
      nodeId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: node.position,
      nodeKind: node.kind,
      element: event.currentTarget,
      frame: 0,
      nextPosition: node.position,
    };
    setSelectedModule(node.module);
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;

    if (!drag) {
      return;
    }

    if (drag.type === "pan") {
      setPan({
        x: drag.startPan.x + event.clientX - drag.startClientX,
        y: drag.startPan.y + event.clientY - drag.startClientY,
      });
      return;
    }

    drag.nextPosition = clampCanvasPosition(
      {
        x: drag.startPosition.x + event.clientX - drag.startClientX,
        y: drag.startPosition.y + event.clientY - drag.startClientY,
      },
      drag.nodeKind
    );

    if (drag.frame === 0) {
      drag.frame = window.requestAnimationFrame(() => {
        drag.frame = 0;
        drag.element.style.transform = canvasPositionTransform(
          drag.nextPosition
        );
      });
    }
  }

  function handleCanvasPointerUp() {
    const drag = dragState.current;

    if (drag?.type === "node") {
      if (drag.frame !== 0) {
        window.cancelAnimationFrame(drag.frame);
        drag.element.style.transform = canvasPositionTransform(
          drag.nextPosition
        );
      }

      setNodePositions((current) => ({
        ...current,
        [drag.nodeId]: drag.nextPosition,
      }));
    }

    dragState.current = null;
  }

  function handleConnectionTarget(targetNode: FlowCanvasNode) {
    if (!connectingFrom || connectingFrom.id === targetNode.id) {
      setConnectingFrom(null);
      return;
    }

    connectCanvasNodes(connectingFrom, targetNode);
    setConnectingFrom(null);
    setSelectedModule(targetNode.module);
  }

  function connectCanvasNodes(sourceNode: FlowCanvasNode, targetNode: FlowCanvasNode) {
    if (sourceNode.kind === "outcome" && targetNode.kind === "action") {
      moveActionToOutcome(targetNode.id, sourceNode.id);
      return;
    }

    if (sourceNode.kind === "action" && targetNode.kind === "action") {
      reorderActionAfter(sourceNode.id, targetNode.id);
    }
  }

  function saveDraft() {
    startTransition(() => {
      void (async () => {
        const response = await saveWorkflow({
          id: workflowId,
          status,
          ...currentDraft(),
        });

        setResult(response);

        if (response.status === "success" && response.workflow) {
          const savedWorkflow = response.workflow;

          setLastSavedAt(formatWorkflowTimestamp(savedWorkflow.updatedAt));

          if (!workflowId) {
            router.replace(`/workflows/${savedWorkflow.id}`);
          } else {
            router.refresh();
          }
        }
      })();
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {result ? (
          <Alert
            variant={result.status === "error" ? "destructive" : "default"}
          >
            {result.status === "error" ? (
              <TriangleAlert className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <AlertTitle>{result.title}</AlertTitle>
            <AlertDescription>{result.description}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Flow builder</CardTitle>
            <CardAction className="flex items-center gap-2">
              <Button
                type="button"
                variant={selectedModule.type === "workflow" ? "default" : "outline"}
                onClick={() => setSelectedModule({ type: "workflow" })}
            >
              <Settings2 className="size-4" />
              Workflow
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPan({ x: 8, y: 8 })}
              aria-label="Reset canvas position"
              title="Reset canvas position"
            >
              <Move className="size-4" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid min-h-[720px] gap-0 p-0 lg:grid-cols-[232px_minmax(0,1fr)]">
          <WidgetPalette
            selectedModule={selectedModule}
            onSelectWorkflow={() => setSelectedModule({ type: "workflow" })}
            onAddOutcome={() => addOutcome()}
            onAddAction={(type) => {
              const outcomeId = selectedOutcomeIdForWidgetDrop({ x: 0, y: 0 });

              if (outcomeId) {
                addAction(outcomeId, type);
              }
            }}
          />
          <div className="flex min-w-0 flex-col">
            <div className="grid gap-3 border-b bg-muted/20 p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <ReadinessRow label="Basics" ready={basicsReady} />
              <ReadinessRow label="Trigger" ready={Boolean(trigger.trim())} />
              <ReadinessRow
                label="Classifier"
                ready={Boolean(classifierPrompt.trim()) && exampleCount > 0}
              />
              <ReadinessRow label="Actions" ready={actionsReady} />
            </div>
            <div
              ref={canvasRef}
              className={cn(
                "relative min-h-[640px] flex-1 overflow-hidden bg-background",
                "bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:28px_28px]"
              )}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleCanvasDrop}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
            >
              <div
                className="absolute left-0 top-0 cursor-grab active:cursor-grabbing"
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  transform: canvasPositionTransform(pan),
                }}
                onPointerDown={handleCanvasPointerDown}
              >
                <FlowEdges edges={canvasEdges} nodes={canvasNodeMap} />
                {canvasNodes.map((node) => (
                  <CanvasNode
                    key={node.id}
                    node={node}
                    selected={moduleKey(selectedModule) === moduleKey(node.module)}
                    connecting={connectingFrom?.id === node.id}
                    canReceiveConnection={Boolean(
                      connectingFrom && connectingFrom.id !== node.id
                    )}
                    onPointerDown={(event) => handleNodePointerDown(event, node)}
                    onSelect={() => setSelectedModule(node.module)}
                    onStartConnection={() => setConnectingFrom(node)}
                    onCompleteConnection={() => handleConnectionTarget(node)}
                  />
                ))}
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                <MousePointer2 className="size-3.5" />
                <span>{connectingFrom ? "Choose a target node" : "Canvas ready"}</span>
              </div>
            </div>
          </div>
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
              onClick={saveDraft}
              disabled={!basicsReady || isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
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

function formatWorkflowTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function WidgetPalette({
  selectedModule,
  onSelectWorkflow,
  onAddOutcome,
  onAddAction,
}: {
  selectedModule: SelectedModule;
  onSelectWorkflow: () => void;
  onAddOutcome: () => void;
  onAddAction: (type: WorkflowActionType) => void;
}) {
  return (
    <div className="border-b bg-muted/20 p-3 lg:border-b-0 lg:border-r">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Widgets</div>
        <Button
          type="button"
          variant={selectedModule.type === "workflow" ? "default" : "ghost"}
          size="icon"
          onClick={onSelectWorkflow}
          aria-label="Workflow settings"
          title="Workflow settings"
        >
          <Settings2 className="size-4" />
        </Button>
      </div>
      <div className="space-y-2">
        <PaletteItem
          title="Branch"
          detail="Classification outcome"
          icon={GitBranch}
          widgetType="outcome"
          onAdd={onAddOutcome}
        />
        {actionTypes.map((type) => {
          const Icon = actionIcons[type];

          return (
            <PaletteItem
              key={type}
              title={actionLabels[type]}
              detail="Action node"
              icon={Icon}
              widgetType={type}
              onAdd={() => onAddAction(type)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PaletteItem({
  title,
  detail,
  icon: Icon,
  widgetType,
  onAdd,
}: {
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  widgetType: PaletteWidgetType;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onClick={onAdd}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-workflow-widget", widgetType);
        event.dataTransfer.effectAllowed = "copy";
      }}
      className="flex min-h-16 w-full items-center gap-3 rounded-md border bg-background px-3 py-2 text-left shadow-sm transition hover:border-primary/60 hover:bg-primary/5"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
      <Grip className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function CanvasNode({
  node,
  selected,
  connecting,
  canReceiveConnection,
  onPointerDown,
  onSelect,
  onStartConnection,
  onCompleteConnection,
}: {
  node: FlowCanvasNode;
  selected: boolean;
  connecting: boolean;
  canReceiveConnection: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onStartConnection: () => void;
  onCompleteConnection: () => void;
}) {
  const Icon = node.icon;
  const height = nodeHeights[node.kind];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute rounded-md border bg-card p-3 text-card-foreground shadow-sm transition-colors",
        "cursor-grab select-none active:cursor-grabbing",
        selected && "border-primary shadow-md ring-2 ring-primary/20",
        connecting && "border-primary bg-primary/10",
        canReceiveConnection && "ring-2 ring-muted-foreground/20"
      )}
      style={{
        width: nodeWidth,
        minHeight: height,
        transform: canvasPositionTransform(node.position),
      }}
    >
      {node.kind !== "trigger" ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCompleteConnection();
          }}
          className={cn(
            "absolute left-0 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background transition",
            canReceiveConnection
              ? "border-primary ring-4 ring-primary/15"
              : "border-border"
          )}
          aria-label={`Connect to ${node.title}`}
          title={`Connect to ${node.title}`}
        />
      ) : null}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onStartConnection();
        }}
        className={cn(
          "absolute right-0 top-1/2 size-4 translate-x-1/2 -translate-y-1/2 rounded-full border bg-background transition",
          connecting ? "border-primary ring-4 ring-primary/15" : "border-border"
        )}
        aria-label={`Start connection from ${node.title}`}
        title={`Start connection from ${node.title}`}
      >
        <span className="sr-only">Connect</span>
      </button>

      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{node.title}</span>
            {node.ready ? (
              <CircleDot className="size-3.5 shrink-0 text-success" />
            ) : null}
          </span>
          <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {node.detail}
          </span>
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{node.meta}</span>
        <Badge variant={node.ready ? "outline" : "destructive"}>
          {node.ready ? "Ready" : "Needs input"}
        </Badge>
      </div>
    </div>
  );
}

function FlowEdges({
  edges,
  nodes,
}: {
  edges: CanvasEdge[];
  nodes: Map<string, FlowCanvasNode>;
}) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 text-muted-foreground"
      height={canvasHeight}
      width={canvasWidth}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
    >
      <defs>
        <marker
          id="workflow-builder-arrow"
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="7"
          refY="4"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const fromNode = nodes.get(edge.from);
        const toNode = nodes.get(edge.to);

        if (!fromNode || !toNode) {
          return null;
        }

        const from = {
          x: fromNode.position.x + nodeWidth,
          y: fromNode.position.y + nodeHeights[fromNode.kind] / 2,
        };
        const to = {
          x: toNode.position.x,
          y: toNode.position.y + nodeHeights[toNode.kind] / 2,
        };
        const bend = Math.max(72, Math.abs(to.x - from.x) * 0.42);

        return (
          <path
            key={`${edge.from}-${edge.to}`}
            d={`M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${
              to.x - bend
            } ${to.y}, ${to.x} ${to.y}`}
            className="fill-none stroke-current stroke-[2]"
            markerEnd="url(#workflow-builder-arrow)"
          />
        );
      })}
    </svg>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
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

function createInitialNodePositions(outcomes: WorkflowOutcome[]) {
  const positions: CanvasPositions = {
    trigger: { x: 72, y: 390 },
    classifier: { x: 382, y: 390 },
  };

  outcomes.forEach((outcome, outcomeIndex) => {
    const y = 72 + outcomeIndex * 178;

    positions[outcome.id] = { x: 700, y };
    outcome.actions.forEach((action, actionIndex) => {
      positions[action.id] = {
        x: 1028 + actionIndex * 288,
        y: y + 10,
      };
    });
  });

  return positions;
}

function createCanvasNodes({
  trigger,
  classifierPrompt,
  outcomes,
  exampleCount,
  nodePositions,
  showWorkflowGraph,
}: {
  trigger: string;
  classifierPrompt: string;
  outcomes: WorkflowOutcome[];
  exampleCount: number;
  nodePositions: CanvasPositions;
  showWorkflowGraph: boolean;
}) {
  const nodes: FlowCanvasNode[] = [
    {
      id: "trigger",
      kind: "trigger",
      module: { type: "trigger" },
      title: "Email watcher",
      detail: trigger || "Mailbox trigger",
      meta: "Initial node",
      icon: Inbox,
      position: nodePositions.trigger ?? { x: 72, y: 390 },
      ready: Boolean(trigger.trim()),
    },
  ];

  if (!showWorkflowGraph) {
    return nodes;
  }

  nodes.push({
    id: "classifier",
    kind: "classifier",
    module: { type: "classifier" },
    title: "Classify with AI",
    detail: classifierPrompt || "AI classification prompt",
    meta: `${outcomes.length} branches, ${exampleCount} examples`,
    icon: Filter,
    position: nodePositions.classifier ?? { x: 382, y: 390 },
    ready: Boolean(classifierPrompt.trim()) && exampleCount > 0,
  });

  outcomes.forEach((outcome, outcomeIndex) => {
    nodes.push({
      id: outcome.id,
      kind: "outcome",
      module: { type: "outcome", outcomeId: outcome.id },
      title: outcome.name,
      detail: outcome.description || "Classification rule",
      meta: `${outcome.actions.length} actions`,
      icon: Sparkles,
      position:
        nodePositions[outcome.id] ?? {
          x: 700,
          y: 72 + outcomeIndex * 178,
        },
      ready: Boolean(outcome.name.trim()) && Boolean(outcome.description.trim()),
      outcomeId: outcome.id,
    });

    outcome.actions.forEach((action, actionIndex) => {
      const Icon = actionIcons[action.type];

      nodes.push({
        id: action.id,
        kind: "action",
        module: {
          type: "action",
          outcomeId: outcome.id,
          actionId: action.id,
        },
        title: actionLabels[action.type],
        detail: actionSummary(action),
        meta: `${outcome.name} branch`,
        icon: Icon,
        position:
          nodePositions[action.id] ?? {
            x: 1028 + actionIndex * 288,
            y: 82 + outcomeIndex * 178,
          },
        ready: actionIsReady(action),
        outcomeId: outcome.id,
        actionId: action.id,
      });
    });
  });

  return nodes;
}

function createCanvasEdges(
  outcomes: WorkflowOutcome[],
  showWorkflowGraph: boolean
) {
  if (!showWorkflowGraph) {
    return [];
  }

  const edges: CanvasEdge[] = [{ from: "trigger", to: "classifier" }];

  outcomes.forEach((outcome) => {
    edges.push({ from: "classifier", to: outcome.id });

    outcome.actions.forEach((action, actionIndex) => {
      edges.push({
        from: actionIndex === 0 ? outcome.id : outcome.actions[actionIndex - 1].id,
        to: action.id,
      });
    });
  });

  return edges;
}

function clampCanvasPosition(position: CanvasNodePosition, kind: CanvasNodeKind) {
  return {
    x: Math.min(Math.max(position.x, 24), canvasWidth - nodeWidth - 24),
    y: Math.min(
      Math.max(position.y, 24),
      canvasHeight - nodeHeights[kind] - 24
    ),
  };
}

function isPaletteWidgetType(value: string): value is PaletteWidgetType {
  return value === "outcome" || actionTypes.includes(value as WorkflowActionType);
}

function moduleKey(module: SelectedModule) {
  if (module.type === "outcome") {
    return `${module.type}:${module.outcomeId}`;
  }

  if (module.type === "action") {
    return `${module.type}:${module.outcomeId}:${module.actionId}`;
  }

  return module.type;
}

function canvasPositionTransform(position: CanvasNodePosition) {
  return `translate3d(${position.x}px, ${position.y}px, 0)`;
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
