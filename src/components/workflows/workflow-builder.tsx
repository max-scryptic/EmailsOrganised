"use client";

import * as React from "react";
import {
  Archive,
  Filter,
  Forward,
  GripVertical,
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

type NodePosition = {
  x: number;
  y: number;
};

type FlowCanvasNode = {
  id: string;
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  module: SelectedModule;
  position: NodePosition;
  width: number;
  height: number;
  badge?: string;
};

type FlowCanvasEdge = {
  id: string;
  from: string;
  to: string;
};

type WorkflowBuilderProps = {
  initialDraft: WorkflowDraft;
  /** "new" starts from a blank draft and asks for a name before saving. */
  mode?: "edit" | "new";
};

const triggerNodeId = "trigger";
const classifierNodeId = "classifier";
const flowNodeWidth = 250;
const flowNodeHeight = 104;
const actionNodeWidth = 230;
const actionNodeHeight = 88;

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
  const [nodePositions, setNodePositions] = React.useState<
    Record<string, NodePosition>
  >({});

  const showWorkflowGraph =
    mode === "edit" || outcomes.length > 0 || Boolean(classifierPrompt.trim());
  const flowNodes = React.useMemo(
    () =>
      createFlowCanvasNodes({
        trigger,
        classifierPrompt,
        outcomes,
        showWorkflowGraph,
        nodePositions,
      }),
    [classifierPrompt, nodePositions, outcomes, showWorkflowGraph, trigger]
  );
  const flowEdges = React.useMemo(
    () => createFlowCanvasEdges(outcomes, showWorkflowGraph),
    [outcomes, showWorkflowGraph]
  );
  const flowNodeMap = React.useMemo(
    () => new Map(flowNodes.map((node) => [node.id, node])),
    [flowNodes]
  );
  const flowCanvasSize = React.useMemo(
    () => getFlowCanvasSize(flowNodes),
    [flowNodes]
  );

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

  const updateNodePosition = React.useCallback(
    (id: string, position: NodePosition) => {
      setNodePositions((current) => ({ ...current, [id]: position }));
    },
    []
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Flow builder</CardTitle>
            <CardAction className="flex flex-wrap justify-end gap-2">
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
              <Button type="button" variant="outline" onClick={addOutcome}>
                <Plus className="size-4" />
                Add branch
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <FlowCanvas
              nodes={flowNodes}
              edges={flowEdges}
              nodeMap={flowNodeMap}
              canvasSize={flowCanvasSize}
              selectedModule={selectedModule}
              onSelectModule={setSelectedModule}
              onNodePositionChange={updateNodePosition}
            />
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
                onAddAction={(type) => addAction(selectedOutcome.id, type)}
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

function FlowCanvas({
  nodes,
  edges,
  nodeMap,
  canvasSize,
  selectedModule,
  onSelectModule,
  onNodePositionChange,
}: {
  nodes: FlowCanvasNode[];
  edges: FlowCanvasEdge[];
  nodeMap: Map<string, FlowCanvasNode>;
  canvasSize: { width: number; height: number };
  selectedModule: SelectedModule;
  onSelectModule: (module: SelectedModule) => void;
  onNodePositionChange: (id: string, position: NodePosition) => void;
}) {
  return (
    <div className="overflow-auto rounded-md border bg-muted/20">
      <div
        className="relative min-h-[360px]"
        style={{ width: canvasSize.width, height: canvasSize.height }}
      >
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden="true"
        >
          {edges.map((edge) => {
            const path = flowEdgePath(edge, nodeMap);

            return path ? (
              <path
                key={edge.id}
                className="stroke-border"
                d={path}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : null;
          })}
        </svg>
        {nodes.map((node) => (
          <DraggableFlowNode
            key={node.id}
            node={node}
            selected={modulesMatch(selectedModule, node.module)}
            onSelect={() => onSelectModule(node.module)}
            onPositionChange={(position) =>
              onNodePositionChange(node.id, position)
            }
          />
        ))}
      </div>
    </div>
  );
}

function DraggableFlowNode({
  node,
  selected,
  onSelect,
  onPositionChange,
}: {
  node: FlowCanvasNode;
  selected: boolean;
  onSelect: () => void;
  onPositionChange: (position: NodePosition) => void;
}) {
  const nodeRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({
    dragging: false,
    frame: 0,
    originClientX: 0,
    originClientY: 0,
    originX: 0,
    originY: 0,
    nextX: node.position.x,
    nextY: node.position.y,
  });
  const Icon = node.icon;

  React.useEffect(() => {
    const element = nodeRef.current;

    if (!element || dragRef.current.dragging) {
      return;
    }

    element.style.transform = positionTransform(node.position);
  }, [node.position]);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const element = nodeRef.current;

    if (!element) {
      return;
    }

    dragRef.current = {
      dragging: true,
      frame: 0,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originX: node.position.x,
      originY: node.position.y,
      nextX: node.position.x,
      nextY: node.position.y,
    };
    element.style.zIndex = "20";

    const applyPosition = () => {
      dragRef.current.frame = 0;
      element.style.transform = positionTransform({
        x: dragRef.current.nextX,
        y: dragRef.current.nextY,
      });
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextX =
        dragRef.current.originX +
        moveEvent.clientX -
        dragRef.current.originClientX;
      const nextY =
        dragRef.current.originY +
        moveEvent.clientY -
        dragRef.current.originClientY;

      dragRef.current.nextX = Math.max(12, nextX);
      dragRef.current.nextY = Math.max(12, nextY);

      if (dragRef.current.frame === 0) {
        dragRef.current.frame = window.requestAnimationFrame(applyPosition);
      }
    };

    const finishDrag = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);

      if (dragRef.current.frame !== 0) {
        window.cancelAnimationFrame(dragRef.current.frame);
        applyPosition();
      }

      dragRef.current.dragging = false;
      element.style.zIndex = "";
      onPositionChange({
        x: dragRef.current.nextX,
        y: dragRef.current.nextY,
      });
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
  }

  return (
    <div
      ref={nodeRef}
      className="absolute will-change-transform"
      style={{
        width: node.width,
        height: node.height,
        transform: positionTransform(node.position),
      }}
    >
      <div
        className={cn(
          "flex size-full items-start gap-3 rounded-md border bg-background p-3 text-left shadow-sm",
          selected && "border-primary bg-primary/10 ring-2 ring-primary/20"
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{node.title}</span>
            <span className="mt-2 block line-clamp-2 text-sm text-muted-foreground">
              {node.detail}
            </span>
            {node.badge ? (
              <Badge variant="secondary" className="mt-2">
                {node.badge}
              </Badge>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          aria-label={`Move ${node.title}`}
          onPointerDown={handlePointerDown}
          className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical className="size-4" />
        </button>
      </div>
    </div>
  );
}

function createFlowCanvasNodes({
  trigger,
  classifierPrompt,
  outcomes,
  showWorkflowGraph,
  nodePositions,
}: {
  trigger: string;
  classifierPrompt: string;
  outcomes: WorkflowOutcome[];
  showWorkflowGraph: boolean;
  nodePositions: Record<string, NodePosition>;
}): FlowCanvasNode[] {
  const nodes: FlowCanvasNode[] = [
    {
      id: triggerNodeId,
      title: "Email watcher",
      detail: trigger,
      icon: Inbox,
      module: { type: "trigger" },
      position: nodePositions[triggerNodeId] ?? { x: 32, y: 48 },
      width: flowNodeWidth,
      height: flowNodeHeight,
      badge: "Initial node",
    },
  ];

  if (!showWorkflowGraph) {
    return nodes;
  }

  nodes.push({
    id: classifierNodeId,
    title: "Filter incoming email",
    detail: classifierPrompt || "Decide which branch should handle the email.",
    icon: Filter,
    module: { type: "classifier" },
    position: nodePositions[classifierNodeId] ?? { x: 360, y: 48 },
    width: flowNodeWidth,
    height: flowNodeHeight,
    badge: `${outcomes.length} branches`,
  });

  outcomes.forEach((outcome, outcomeIndex) => {
    const column = outcomeIndex % 2;
    const row = Math.floor(outcomeIndex / 2);
    const outcomeId = outcomeNodeId(outcome.id);
    const baseX = 88 + column * 360;
    const baseY = 224 + row * 260;

    nodes.push({
      id: outcomeId,
      title: outcome.name || "New classification",
      detail: outcome.description || "Classification rule",
      icon: Sparkles,
      module: { type: "outcome", outcomeId: outcome.id },
      position: nodePositions[outcomeId] ?? { x: baseX, y: baseY },
      width: flowNodeWidth,
      height: flowNodeHeight,
      badge: `${outcome.actions.length} actions`,
    });

    outcome.actions.forEach((action, actionIndex) => {
      const actionId = actionNodeId(action.id);

      nodes.push({
        id: actionId,
        title: actionLabels[action.type],
        detail: actionSummary(action),
        icon: actionIcons[action.type],
        module: {
          type: "action",
          outcomeId: outcome.id,
          actionId: action.id,
        },
        position: nodePositions[actionId] ?? {
          x: baseX + actionIndex * 250,
          y: baseY + 150,
        },
        width: actionNodeWidth,
        height: actionNodeHeight,
      });
    });
  });

  return nodes;
}

function createFlowCanvasEdges(
  outcomes: WorkflowOutcome[],
  showWorkflowGraph: boolean
): FlowCanvasEdge[] {
  if (!showWorkflowGraph) {
    return [];
  }

  const edges: FlowCanvasEdge[] = [
    {
      id: "trigger-to-classifier",
      from: triggerNodeId,
      to: classifierNodeId,
    },
  ];

  outcomes.forEach((outcome) => {
    const outcomeId = outcomeNodeId(outcome.id);

    edges.push({
      id: `${classifierNodeId}-to-${outcomeId}`,
      from: classifierNodeId,
      to: outcomeId,
    });

    outcome.actions.forEach((action, actionIndex) => {
      const previousAction = outcome.actions[actionIndex - 1];

      edges.push({
        id: previousAction
          ? `${actionNodeId(previousAction.id)}-to-${actionNodeId(action.id)}`
          : `${outcomeId}-to-${actionNodeId(action.id)}`,
        from: previousAction ? actionNodeId(previousAction.id) : outcomeId,
        to: actionNodeId(action.id),
      });
    });
  });

  return edges;
}

function flowEdgePath(
  edge: FlowCanvasEdge,
  nodeMap: Map<string, FlowCanvasNode>
) {
  const from = nodeMap.get(edge.from);
  const to = nodeMap.get(edge.to);

  if (!from || !to) {
    return null;
  }

  const x1 = from.position.x + from.width;
  const y1 = from.position.y + from.height / 2;
  const x2 = to.position.x;
  const y2 = to.position.y + to.height / 2;
  const distance = Math.max(80, Math.abs(x2 - x1) / 2);
  const c1 = x1 + distance;
  const c2 = x2 - distance;

  return `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`;
}

function getFlowCanvasSize(nodes: FlowCanvasNode[]) {
  return nodes.reduce(
    (size, node) => ({
      width: Math.max(size.width, node.position.x + node.width + 48),
      height: Math.max(size.height, node.position.y + node.height + 48),
    }),
    { width: 760, height: 420 }
  );
}

function modulesMatch(first: SelectedModule, second: SelectedModule) {
  if (first.type !== second.type) {
    return false;
  }

  if (first.type === "outcome" && second.type === "outcome") {
    return first.outcomeId === second.outcomeId;
  }

  if (first.type === "action" && second.type === "action") {
    return (
      first.outcomeId === second.outcomeId && first.actionId === second.actionId
    );
  }

  return true;
}

function positionTransform(position: NodePosition) {
  return `translate3d(${position.x}px, ${position.y}px, 0)`;
}

function outcomeNodeId(outcomeId: string) {
  return `outcome-${outcomeId}`;
}

function actionNodeId(actionId: string) {
  return `action-${actionId}`;
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
  onAddAction,
  onChange,
}: {
  outcome: WorkflowOutcome;
  onAddAction: (type: WorkflowActionType) => void;
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
      <div className="space-y-2">
        <Label>Actions</Label>
        <div className="grid gap-2">
          {actionTypes.map((type) => {
            const Icon = actionIcons[type];

            return (
              <Button
                key={type}
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => onAddAction(type)}
              >
                <Icon className="size-4" />
                {actionLabels[type]}
              </Button>
            );
          })}
        </div>
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
