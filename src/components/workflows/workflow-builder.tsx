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
  Plus,
  Save,
  Sparkles,
  Tag,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { saveWorkflow } from "@/app/workflows/actions";
import { InlineEditableText } from "@/components/workflows/inline-editable-text";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useConfirmDialog } from "@/components/use-confirm-dialog";
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
/** The inspector floats beside the node it belongs to, so it needs fixed dims. */
const inspectorWidth = 320;
const inspectorGap = 16;
const inspectorMargin = 12;
const defaultInspectorHeight = 360;
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
  module: SelectedModule;
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

/**
 * The node whose settings the board's inspector is showing. `null` is a board
 * with nothing selected — workflow-level fields live in the page heading now,
 * not in a panel.
 */
type SelectedModule =
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
  /** Page-level buttons (run, delete) rendered beside Save in the heading. */
  actions?: React.ReactNode;
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
  actions,
}: WorkflowBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef<DragState | null>(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const inspectorRef = React.useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = React.useState({ width: 0, height: 0 });
  const [inspectorHeight, setInspectorHeight] = React.useState(
    defaultInspectorHeight
  );
  // Measures the inspector as it mounts and resizes so the placement maths
  // knows how much room the panel actually needs.
  const inspectorNodeRef = React.useCallback((node: HTMLDivElement) => {
    inspectorRef.current = node;

    const observer = new ResizeObserver(([entry]) => {
      setInspectorHeight(entry.contentRect.height);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
      inspectorRef.current = null;
    };
  }, []);
  const [workflowName, setWorkflowName] = React.useState(initialDraft.name);
  const [detail, setDetail] = React.useState(initialDraft.detail);
  // No longer edited in the builder header — kept so saving a draft round-trips
  // whatever owner the workflow already has.
  const ownerRole = initialDraft.ownerRole;
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
  const [selectedModule, setSelectedModule] =
    React.useState<SelectedModule | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const showWorkflowGraph =
    mode === "edit" || outcomes.length > 0 || Boolean(classifierPrompt.trim());
  const [result, setResult] = React.useState<WorkflowResult>(null);

  const selectedOutcome =
    selectedModule && "outcomeId" in selectedModule
      ? outcomes.find((outcome) => outcome.id === selectedModule.outcomeId)
      : undefined;
  const selectedAction =
    selectedModule?.type === "action"
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
  const selectedNode = React.useMemo(
    () =>
      canvasNodes.find(
        (node) => moduleKey(node.module) === moduleKey(selectedModule)
      ) ?? null,
    [canvasNodes, selectedModule]
  );
  const inspectorPosition = selectedNode
    ? inspectorScreenPosition({
        nodePosition: selectedNode.position,
        pan,
        board: boardSize,
        inspectorHeight,
      })
    : null;

  const basicsReady = Boolean(workflowName.trim()) && Boolean(detail.trim());
  const actionsReady =
    outcomes.length > 0 &&
    outcomes.every(
      (outcome) =>
        outcome.actions.length > 0 && outcome.actions.every(actionIsReady)
    );

  // The board measures itself so the inspector can flip sides and stay inside
  // the visible area instead of hanging off the edge of the card.
  React.useEffect(() => {
    const board = canvasRef.current;

    if (!board) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setBoardSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(board);

    return () => observer.disconnect();
  }, []);

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
      actions: outcome.actions.filter((action) => action.id !== actionId),
    }));
    setNodePositions((current) => {
      const next = { ...current };
      delete next[actionId];
      return next;
    });
    setConnectingFrom(null);
    setSelectedModule(null);
  }

  /** A branch takes its action nodes with it when it leaves the board. */
  function removeOutcome(outcomeId: string) {
    const removedOutcome = outcomes.find((outcome) => outcome.id === outcomeId);

    setOutcomes((current) =>
      current.filter((outcome) => outcome.id !== outcomeId)
    );
    setNodePositions((current) => {
      const next = { ...current };

      delete next[outcomeId];
      removedOutcome?.actions.forEach((action) => {
        delete next[action.id];
      });

      return next;
    });
    setConnectingFrom(null);
    setSelectedModule(null);
  }

  const isConfirmingDelete = React.useRef(false);

  async function deleteModule(module: SelectedModule) {
    if (module.type === "action") {
      removeAction(module.outcomeId, module.actionId);
      return;
    }

    if (module.type !== "outcome") {
      return;
    }

    const outcome = outcomes.find(
      (current) => current.id === module.outcomeId
    );

    if (!outcome) {
      return;
    }

    // Removing a branch cascades to its actions, so confirm when there is
    // something to lose. A lone action node deletes straight away.
    if (outcome.actions.length > 0) {
      // A second Backspace while the dialog is open must not stack confirms.
      if (isConfirmingDelete.current) {
        return;
      }

      isConfirmingDelete.current = true;

      const confirmed = await confirm({
        title: "Delete this branch?",
        description: `${
          outcome.name.trim() || "This branch"
        } and its ${outcome.actions.length} action${
          outcome.actions.length === 1 ? "" : "s"
        } will be removed from the flow.`,
        confirmLabel: "Delete branch",
      });

      isConfirmingDelete.current = false;

      if (!confirmed) {
        return;
      }
    }

    removeOutcome(module.outcomeId);
  }

  const deleteModuleRef = React.useRef(deleteModule);

  React.useEffect(() => {
    deleteModuleRef.current = deleteModule;
  });

  // Backspace / Delete removes the selected node, as long as the keystroke is
  // not meant for a field in the inspector.
  React.useEffect(() => {
    if (!selectedModule || !canDeleteModule(selectedModule)) {
      return;
    }

    const moduleToDelete = selectedModule;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

      if (isTextEntryTarget(event.target)) {
        return;
      }

      event.preventDefault();
      void deleteModuleRef.current(moduleToDelete);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedModule]);

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

    if (selectedModule && "outcomeId" in selectedModule) {
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
    // Clicking the board itself is how you dismiss the node inspector.
    setSelectedModule(null);
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
        syncInspectorToPosition(drag.nodeId, drag.nextPosition);
      });
    }
  }

  /** Keeps the floating inspector glued to its node while the node is dragged. */
  function syncInspectorToPosition(
    nodeId: string,
    position: CanvasNodePosition
  ) {
    const inspector = inspectorRef.current;

    if (!inspector || selectedNode?.id !== nodeId) {
      return;
    }

    inspector.style.transform = canvasPositionTransform(
      inspectorScreenPosition({
        nodePosition: position,
        pan,
        board: boardSize,
        inspectorHeight,
      })
    );
  }

  function handleCanvasPointerUp() {
    const drag = dragState.current;

    if (drag?.type === "node") {
      if (drag.frame !== 0) {
        window.cancelAnimationFrame(drag.frame);
        drag.element.style.transform = canvasPositionTransform(
          drag.nextPosition
        );
        syncInspectorToPosition(drag.nodeId, drag.nextPosition);
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {result ? (
        <Alert variant={result.status === "error" ? "destructive" : "default"}>
          {result.status === "error" ? (
            <TriangleAlert className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          <AlertTitle>{result.title}</AlertTitle>
          <AlertDescription>{result.description}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <InlineEditableText
            value={workflowName}
            onChange={setWorkflowName}
            label="workflow name"
            placeholder="Name this workflow"
            className="text-2xl font-semibold tracking-normal sm:text-3xl"
          />
          <InlineEditableText
            value={detail}
            onChange={setDetail}
            label="workflow detail"
            placeholder="Describe in one line what this workflow does"
            multiline
            className="max-w-2xl text-sm text-muted-foreground"
          />
        </div>
        <div className="flex shrink-0 flex-col gap-1 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <Button
              type="button"
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
          </div>
          {!basicsReady ? (
            <p className="text-xs text-muted-foreground">
              Name the workflow and add a one-line detail before saving it.
            </p>
          ) : lastSavedAt ? (
            <p className="text-xs text-muted-foreground">
              Draft saved at {lastSavedAt}.
            </p>
          ) : null}
        </div>
      </div>

      <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
        <div
          ref={canvasRef}
          className={cn(
            // A container so the floating panels lay themselves out against the
            // board's own width, not the viewport's.
            "@container relative min-h-0 flex-1 overflow-hidden bg-background",
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

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
            <ReadinessChip label="Basics" ready={basicsReady} />
            <ReadinessChip label="Trigger" ready={Boolean(trigger.trim())} />
            <ReadinessChip
              label="Classifier"
              ready={Boolean(classifierPrompt.trim()) && exampleCount > 0}
            />
            <ReadinessChip label="Actions" ready={actionsReady} />
          </div>

          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="bg-background/95 shadow-sm"
              onClick={() => setPan({ x: 8, y: 8 })}
              aria-label="Reset board position"
              title="Reset board position"
            >
              <Move className="size-4" />
            </Button>
            <span className="pointer-events-none flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <MousePointer2 className="size-3.5" />
              {connectingFrom ? "Choose a target node" : "Board ready"}
            </span>
          </div>

          <NodePalette
            open={isPaletteOpen}
            canAddAction={outcomes.length > 0}
            onOpenChange={setIsPaletteOpen}
            onAddOutcome={() => {
              addOutcome();
              setIsPaletteOpen(false);
            }}
            onAddAction={(type) => {
              const outcomeId = selectedOutcomeIdForWidgetDrop({ x: 0, y: 0 });

              if (outcomeId) {
                addAction(outcomeId, type);
                setIsPaletteOpen(false);
              }
            }}
          />

          {selectedModule && inspectorPosition ? (
            <NodeInspector
              ref={inspectorNodeRef}
              module={selectedModule}
              title={moduleTitle(selectedModule, selectedOutcome, selectedAction)}
              position={inspectorPosition}
              maxHeight={Math.max(
                200,
                (boardSize.height || defaultInspectorHeight) -
                  inspectorMargin * 2
              )}
              canDelete={canDeleteModule(selectedModule)}
              onDelete={() => void deleteModule(selectedModule)}
              onClose={() => setSelectedModule(null)}
            >
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
                  onChange={(updater) =>
                    updateAction(selectedOutcome.id, selectedAction.id, updater)
                  }
                />
              ) : null}
            </NodeInspector>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog />
    </div>
  );
}

function formatWorkflowTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * The board's own add-node control: a button in the bottom-right corner that
 * expands into the list of nodes you can click or drag onto the board.
 */
function NodePalette({
  open,
  canAddAction,
  onOpenChange,
  onAddOutcome,
  onAddAction,
}: {
  open: boolean;
  canAddAction: boolean;
  onOpenChange: (open: boolean) => void;
  onAddOutcome: () => void;
  onAddAction: (type: WorkflowActionType) => void;
}) {
  return (
    <div
      // Spans the board's height so a tall list scrolls instead of being
      // clipped, but only the panel and the button take clicks.
      className="pointer-events-none absolute inset-y-3 right-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col items-end justify-end gap-2"
    >
      {open ? (
        <div className="pointer-events-auto min-h-0 w-64 max-w-full overflow-y-auto rounded-lg border bg-card p-2 shadow-lg">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <span className="text-sm font-medium">Add a node</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onOpenChange(false)}
              aria-label="Close node list"
            >
              <X className="size-4" />
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
                  disabled={!canAddAction}
                  disabledHint="Add a branch before adding actions"
                  onAdd={() => onAddAction(type)}
                />
              );
            })}
          </div>
          <p className="px-1 pt-2 text-xs text-muted-foreground">
            Click to drop it on the board, or drag it where you want it.
          </p>
        </div>
      ) : null}
      <Button
        type="button"
        size="icon"
        className="pointer-events-auto size-11 shrink-0 rounded-full shadow-lg"
        aria-expanded={open}
        aria-label={open ? "Hide the node list" : "Show the node list"}
        title={open ? "Hide the node list" : "Show the node list"}
        onClick={() => onOpenChange(!open)}
      >
        {open ? <X className="size-5" /> : <Plus className="size-5" />}
      </Button>
    </div>
  );
}

function PaletteItem({
  title,
  detail,
  icon: Icon,
  widgetType,
  disabled = false,
  disabledHint,
  onAdd,
}: {
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  widgetType: PaletteWidgetType;
  disabled?: boolean;
  disabledHint?: string;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      onClick={onAdd}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-workflow-widget", widgetType);
        event.dataTransfer.effectAllowed = "copy";
      }}
      className="flex min-h-14 w-full items-center gap-3 rounded-md border bg-background px-3 py-2 text-left shadow-sm transition hover:border-primary/60 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
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

/**
 * Settings for the selected node, floating right beside that node like a
 * popover rather than docking to the side of the page.
 */
function NodeInspector({
  ref,
  module,
  title,
  position,
  maxHeight,
  canDelete,
  onDelete,
  onClose,
  children,
}: {
  ref: React.Ref<HTMLDivElement>;
  module: SelectedModule;
  title: string;
  /** Board-relative pixels, already flipped and clamped to stay on screen. */
  position: CanvasNodePosition;
  maxHeight: number;
  canDelete: boolean;
  onDelete: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${moduleLabel(module)} settings`}
      className="absolute left-0 top-0 z-40 flex max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border bg-card shadow-xl duration-150 animate-in fade-in-0 zoom-in-95"
      style={{
        width: inspectorWidth,
        maxHeight,
        transform: canvasPositionTransform(position),
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline">{moduleLabel(module)}</Badge>
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClose}
          aria-label="Close node settings"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      {canDelete ? (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Or press Backspace
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
            Delete node
          </Button>
        </div>
      ) : null}
    </div>
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

function ReadinessChip({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full border bg-background/95 px-2.5 py-1 text-xs shadow-sm",
        ready ? "text-muted-foreground" : "border-destructive/40 text-destructive"
      )}
    >
      {ready ? (
        <CircleDot className="size-3 text-success" />
      ) : (
        <TriangleAlert className="size-3" />
      )}
      {label}
      <span className="sr-only">{ready ? "ready" : "needs input"}</span>
    </span>
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

function moduleKey(module: SelectedModule | null) {
  if (!module) {
    return "none";
  }

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

/** Only the nodes a workflow can live without can be deleted. */
function canDeleteModule(module: SelectedModule) {
  return module.type === "outcome" || module.type === "action";
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]'
    )
  );
}

/**
 * Places the inspector beside its node in board pixels: to the right when it
 * fits, flipped to the left when it does not, then nudged back inside the
 * board so it is never half off the edge.
 */
function inspectorScreenPosition({
  nodePosition,
  pan,
  board,
  inspectorHeight,
}: {
  nodePosition: CanvasNodePosition;
  pan: CanvasNodePosition;
  board: { width: number; height: number };
  inspectorHeight: number;
}): CanvasNodePosition {
  const nodeLeft = nodePosition.x + pan.x;
  const nodeTop = nodePosition.y + pan.y;
  const rightX = nodeLeft + nodeWidth + inspectorGap;
  const leftX = nodeLeft - inspectorGap - inspectorWidth;

  let x = rightX;

  if (
    board.width > 0 &&
    rightX + inspectorWidth > board.width - inspectorMargin &&
    leftX >= inspectorMargin
  ) {
    x = leftX;
  }

  if (board.width > 0) {
    const maxX = Math.max(
      inspectorMargin,
      board.width - inspectorWidth - inspectorMargin
    );

    x = Math.min(Math.max(x, inspectorMargin), maxX);
  }

  let y = nodeTop;

  if (board.height > 0) {
    const maxY = Math.max(
      inspectorMargin,
      board.height - inspectorHeight - inspectorMargin
    );

    y = Math.min(Math.max(y, inspectorMargin), maxY);
  }

  return { x, y };
}

function moduleTitle(
  module: SelectedModule,
  outcome: WorkflowOutcome | undefined,
  action: WorkflowAction | undefined
) {
  if (module.type === "trigger") {
    return "Email watcher";
  }

  if (module.type === "classifier") {
    return "Classify with AI";
  }

  if (module.type === "outcome") {
    return outcome?.name || "Branch";
  }

  return action ? actionLabels[action.type] : "Action";
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
  onChange,
}: {
  action: WorkflowAction;
  onChange: (updater: (action: WorkflowAction) => WorkflowAction) => void;
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
