"use client";

import * as React from "react";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Forward,
  Grip,
  Inbox,
  Link2,
  Loader2,
  MailCheck,
  Minus,
  Play,
  Plus,
  Save,
  Sparkles,
  Tag,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { saveWorkflow, testClassification } from "@/app/workflows/actions";
import { InlineEditableText } from "@/components/workflows/inline-editable-text";
import {
  NodeOutputSummary,
  UpstreamDataPanel,
} from "@/components/workflows/node-data-panel";
import {
  useWorkflowDebug,
  WorkflowDebugBar,
  WorkflowDebugDialog,
  WorkflowDebugStepPanel,
} from "@/components/workflows/workflow-debug";
import {
  VariableInsertProvider,
  VariableInput,
  VariableTextarea,
} from "@/components/workflows/variable-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  createClassificationLabel,
  createWorkflowAction,
  defaultWorkflowNamePrefix,
  usableClassificationLabels,
  type ClassificationLabel,
  type WorkflowAction,
  type WorkflowActionType,
  type WorkflowDraft,
  type WorkflowStatus,
} from "@/lib/workflow-data";
import {
  chainNodeOutputTitle,
  chainOutputFields,
  type NodeOutputGroup,
  type VariableChainNode,
} from "@/lib/workflow-variables";

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
/**
 * A node says what it is and nothing else, so it is sized for one line of text
 * beside one icon — wide enough that a node's name still fits whole beside the
 * status marker a test run puts there. Everything a node used to summarise on the board — the
 * prompt, the counts, the readiness badge — lives in its settings panel, which
 * is where it can be acted on.
 */
const nodeWidth = 252;
const nodeBaseHeight = 60;
/**
 * The classification node is the one exception: it grows a row per output
 * label, because each of those rows is an outlet the flow branches from and an
 * unnamed outlet is not a flow anyone can read.
 */
const branchRowHeight = 26;
const branchListPaddingBottom = 10;
/**
 * How far the board can be scaled. The floor keeps a node's label readable;
 * the ceiling is about as close as you can get before the grid stops helping.
 */
const minZoom = 0.4;
const maxZoom = 2;
/** One press of a zoom button. Multiplicative, so the steps feel even. */
const zoomButtonStep = 1.2;
/** Zoom is a float, so the buttons compare against the limits with slack. */
const zoomEpsilon = 0.001;
/** The board's background grid, in board pixels. */
const canvasGridSize = 28;
/**
 * The inspector floats beside the node it belongs to, so it needs fixed dims.
 * It is two columns: upstream data on the left, everything about the selected
 * node on the right. A node with nothing before it drops the left column and
 * the panel narrows to the settings alone.
 */
const inspectorSettingsWidth = 320;
const inspectorDataWidth = 256;
const inspectorWidth = inspectorDataWidth + inspectorSettingsWidth;
const inspectorGap = 16;
const inspectorMargin = 12;
const defaultInspectorHeight = 360;
/** The add-node menu the output handle opens, floated the same way. */
const connectMenuWidth = 264;
const defaultConnectMenuHeight = 340;
/**
 * How far the pointer has to travel before a press on a node counts as a drag
 * rather than a click. Below it the node stays put and the press selects the
 * node; above it the node moves and the inspector stays closed.
 */
const nodeDragThreshold = 4;
/** Gap the auto-placed node leaves after the node it was added from. */
const autoPlaceGap = 78;
const autoPlaceStep = 96;
/** Where the fixed spine sits before anyone drags it. */
const defaultTriggerPosition = { x: 96, y: 300 };
const defaultClassifierPosition = { x: 400, y: 288 };

type CanvasNodeKind = "trigger" | "classifier" | "action";

/** One output label as the board draws it: a row with an outlet on its edge. */
type CanvasBranch = {
  labelId: string;
  name: string;
};

/**
 * How a node reads during a test: the trigger while it waits for mail, then —
 * once a run starts — the node the run is on, the ones it has been through, the
 * ones still to come, and the ones this email never reaches.
 */
type DebugNodeState = "listening" | "active" | "passed" | "ahead" | "muted";

type CanvasNodePosition = {
  x: number;
  y: number;
};

/**
 * Where the board is looking: how far it has been panned, in board-container
 * pixels, and how far it has been scaled. Pan and zoom travel together because
 * zooming around a point moves both at once.
 */
type CanvasView = CanvasNodePosition & {
  zoom: number;
};

type CanvasPositions = Record<string, CanvasNodePosition>;

type FlowCanvasNode = {
  id: string;
  kind: CanvasNodeKind;
  module: SelectedModule;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  position: CanvasNodePosition;
  /** Board pixels. Only the classification node's varies, with its branches. */
  height: number;
  ready: boolean;
  /** What is still missing, shown on the node's warning marker. */
  needs?: string;
  /** Set on the classification node: one entry per output label. */
  branches?: CanvasBranch[];
  /** Set on action nodes: the branch the action runs under. */
  labelId?: string;
  actionId?: string;
  /** Set on action nodes: which outputs the node publishes downstream. */
  actionType?: WorkflowActionType;
};

type CanvasEdge = {
  from: string;
  to: string;
  /** Set when the edge leaves a classification branch rather than a node edge. */
  fromBranchIndex?: number;
};

/**
 * Where an edge or a menu attaches to a node: the node, plus which of its
 * output branches when it has more than one.
 */
type CanvasOutlet = {
  node: FlowCanvasNode;
  branchIndex?: number;
};

type PaletteWidgetType = WorkflowActionType;

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
      nodeHeight: number;
      element: HTMLDivElement;
      frame: number;
      nextPosition: CanvasNodePosition;
      /** Flips once the pointer clears `nodeDragThreshold`. */
      moved: boolean;
    };

/**
 * The node whose settings the board's inspector is showing. `null` is a board
 * with nothing selected — workflow-level fields live in the page heading now,
 * not in a panel.
 */
type SelectedModule =
  | { type: "trigger" }
  | { type: "classifier" }
  | { type: "action"; labelId: string; actionId: string };

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
  // Edges are redrawn straight on the DOM while a node is dragged, so they
  // track the node frame by frame instead of waiting for the drag to end.
  const edgePathRefs = React.useRef(new Map<string, SVGPathElement>());
  // Set when a node drag ends, so the trailing click does not open the
  // inspector for the node that was just moved.
  const ignoreNodeClick = React.useRef(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const inspectorRef = React.useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = React.useState({ width: 0, height: 0 });
  // Both floating panels measure themselves so the placement maths knows how
  // much room they actually need.
  const { height: inspectorHeight, measure: measureInspector } =
    useMeasuredHeight(defaultInspectorHeight);
  const { height: connectMenuHeight, measure: measureConnectMenu } =
    useMeasuredHeight(defaultConnectMenuHeight);
  const registerEdgePath = React.useCallback(
    (key: string, element: SVGPathElement | null) => {
      if (element) {
        edgePathRefs.current.set(key, element);
        return;
      }

      edgePathRefs.current.delete(key);
    },
    []
  );
  // The inspector is also moved directly during a node drag, so it keeps a ref
  // alongside the measurement.
  const inspectorNodeRef = React.useCallback(
    (node: HTMLDivElement) => {
      inspectorRef.current = node;

      const stopMeasuring = measureInspector(node);

      return () => {
        stopMeasuring();
        inspectorRef.current = null;
      };
    },
    [measureInspector]
  );
  const [workflowName, setWorkflowName] = React.useState(initialDraft.name);
  // No longer edited in the builder header — kept so saving a draft round-trips
  // whatever owner the workflow already has.
  const ownerRole = initialDraft.ownerRole;
  const [trigger, setTrigger] = React.useState(initialDraft.trigger);
  const [classifierPrompt, setClassifierPrompt] = React.useState(
    initialDraft.classifierPrompt
  );
  const [labels, setLabels] = React.useState(initialDraft.labels);
  const [nodePositions, setNodePositions] = React.useState<CanvasPositions>(
    createInitialNodePositions
  );
  const [view, setView] = React.useState<CanvasView>({ x: 8, y: 8, zoom: 1 });
  /**
   * True only while the board is being dragged. The grab hand belongs to the
   * drag, not to the board sitting there — idle, the pointer stays an arrow.
   */
  const [isPanning, setIsPanning] = React.useState(false);
  const [connectingFrom, setConnectingFrom] =
    React.useState<CanvasOutlet | null>(null);
  /**
   * The outlet whose handle opened the add-node menu. Held by id so the menu
   * follows the node as it moves rather than freezing an old position.
   */
  const [connectMenu, setConnectMenu] = React.useState<{
    nodeId: string;
    branchIndex?: number;
  } | null>(null);
  const [selectedModule, setSelectedModule] =
    React.useState<SelectedModule | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<WorkflowResult>(null);
  const draft = React.useMemo<WorkflowDraft>(
    () => ({
      name: workflowName,
      ownerRole,
      trigger,
      classifierPrompt,
      labels,
    }),
    [classifierPrompt, labels, ownerRole, trigger, workflowName]
  );
  /**
   * A test run works on the draft that is on the board, not on the saved row,
   * so a workflow can be tested before it has ever been saved.
   */
  const debug = useWorkflowDebug(draft);
  const { height: debugPanelHeight, measure: measureDebugPanel } =
    useMeasuredHeight(defaultInspectorHeight);

  const selectedLabel =
    selectedModule?.type === "action"
      ? labels.find((label) => label.id === selectedModule.labelId)
      : undefined;
  const selectedAction =
    selectedModule?.type === "action"
      ? selectedLabel?.actions.find(
          (action) => action.id === selectedModule.actionId
        )
      : undefined;

  const canvasNodes = React.useMemo(
    () =>
      createCanvasNodes({
        trigger,
        classifierPrompt,
        labels,
        nodePositions,
      }),
    [classifierPrompt, labels, nodePositions, trigger]
  );
  const canvasNodeMap = React.useMemo(
    () => new Map(canvasNodes.map((node) => [node.id, node])),
    [canvasNodes]
  );
  const canvasEdges = React.useMemo(() => createCanvasEdges(labels), [labels]);
  const selectedNode = React.useMemo(
    () =>
      canvasNodes.find(
        (node) => moduleKey(node.module) === moduleKey(selectedModule)
      ) ?? null,
    [canvasNodes, selectedModule]
  );
  // Each node has exactly one node feeding it, so the run that reaches the
  // selected node — and with it the data that node can read — is the path back
  // up the edges to the trigger.
  const parentByNode = React.useMemo(() => {
    const parents = new Map<string, string>();

    canvasEdges.forEach((edge) => {
      if (!parents.has(edge.to)) {
        parents.set(edge.to, edge.from);
      }
    });

    return parents;
  }, [canvasEdges]);
  const nodeData = React.useMemo(
    () =>
      selectedNode
        ? nodeDataGroups({
            node: selectedNode,
            nodes: canvasNodeMap,
            parents: parentByNode,
          })
        : { upstream: [], own: null },
    [canvasNodeMap, parentByNode, selectedNode]
  );
  const hasUpstreamData = nodeData.upstream.length > 0;
  // The panel is only as wide as it has columns to show, and never wider than
  // the board it floats over.
  const inspectorPanelWidth = Math.min(
    hasUpstreamData ? inspectorWidth : inspectorSettingsWidth,
    boardSize.width > 0
      ? Math.max(inspectorSettingsWidth, boardSize.width - inspectorMargin * 2)
      : Number.POSITIVE_INFINITY
  );
  const inspectorPosition = selectedNode
    ? floatingPanelPosition({
        nodePosition: selectedNode.position,
        view,
        board: boardSize,
        panelWidth: inspectorPanelWidth,
        panelHeight: inspectorHeight,
      })
    : null;
  const connectMenuNode = connectMenu
    ? canvasNodeMap.get(connectMenu.nodeId) ?? null
    : null;
  const connectMenuOutlet: CanvasOutlet | null = connectMenuNode
    ? { node: connectMenuNode, branchIndex: connectMenu?.branchIndex }
    : null;
  const connectMenuPosition = connectMenuOutlet
    ? floatingPanelPosition({
        nodePosition: outletPosition(connectMenuOutlet),
        view,
        board: boardSize,
        panelWidth: connectMenuWidth,
        panelHeight: connectMenuHeight,
      })
    : null;

  // The step panel floats beside the node the run is on, exactly the way the
  // settings inspector floats beside the node you are editing.
  const debugNode = debug.step
    ? canvasNodeMap.get(debug.step.nodeId) ?? null
    : null;
  const debugPanelWidth = Math.min(
    inspectorSettingsWidth,
    boardSize.width > 0
      ? Math.max(240, boardSize.width - inspectorMargin * 2)
      : Number.POSITIVE_INFINITY
  );
  const debugPanelPosition = debugNode
    ? floatingPanelPosition({
        nodePosition: debugNode.position,
        view,
        board: boardSize,
        panelWidth: debugPanelWidth,
        panelHeight: debugPanelHeight,
      })
    : null;

  // A name is optional, so the only thing worth saying beside Save is what an
  // unnamed workflow will end up called — or when the last save landed.
  const saveHint = !workflowName.trim()
    ? "Unnamed workflows are numbered for you."
    : lastSavedAt
      ? `Draft saved at ${lastSavedAt}.`
      : null;
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

  /**
   * Trackpad gestures over the board. A pinch reaches the browser as a wheel
   * event with `ctrlKey` set, so that is what zooms; a plain two-finger scroll
   * pans, the way it does in every other board tool.
   *
   * Listening natively rather than through `onWheel` because React attaches
   * wheel listeners passively, and both gestures have to call
   * `preventDefault()` — the pinch to stop the browser zooming the page, the
   * scroll to stop it rubber-banding.
   */
  React.useEffect(() => {
    const board = canvasRef.current;

    if (!board) {
      return;
    }

    // An arrow rather than a declaration so `board` stays narrowed inside it.
    const handleWheel = (event: WheelEvent) => {
      const target = event.target;

      // The floating panels scroll their own content — the board must not
      // steal the gesture out from under them.
      if (
        target instanceof Element &&
        target.closest("[data-canvas-overlay]")
      ) {
        return;
      }

      const delta = wheelDelta(event);

      event.preventDefault();

      if (event.ctrlKey || event.metaKey) {
        const bounds = board.getBoundingClientRect();
        const focal = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        };

        setView((current) =>
          zoomView(current, focal, current.zoom * wheelZoomFactor(delta.y))
        );
        return;
      }

      setView((current) => ({
        ...current,
        x: current.x - delta.x,
        y: current.y - delta.y,
      }));
    };

    board.addEventListener("wheel", handleWheel, { passive: false });

    return () => board.removeEventListener("wheel", handleWheel);
  }, []);

  /** The zoom buttons have no pointer to anchor to, so they hold the middle. */
  function zoomFromButton(nextZoom: (current: number) => number) {
    setView((current) =>
      zoomView(
        current,
        { x: boardSize.width / 2, y: boardSize.height / 2 },
        nextZoom(current.zoom)
      )
    );
  }

  function updateLabel(
    id: string,
    updater: (label: ClassificationLabel) => ClassificationLabel
  ) {
    setLabels((current) =>
      current.map((label) => (label.id === id ? updater(label) : label))
    );
  }

  /** A new, unnamed output. Naming it is the next thing the panel asks for. */
  function addLabel() {
    setLabels((current) => [...current, createClassificationLabel()]);
  }

  /** An output takes the actions on its branch with it. */
  function removeLabel(labelId: string) {
    const removed = labels.find((label) => label.id === labelId);

    setLabels((current) => current.filter((label) => label.id !== labelId));
    setNodePositions((current) => {
      const next = { ...current };

      removed?.actions.forEach((action) => {
        delete next[action.id];
      });

      return next;
    });
    setConnectingFrom(null);
    setConnectMenu(null);
    setSelectedModule((current) =>
      current?.type === "action" && current.labelId === labelId ? null : current
    );
  }

  async function confirmRemoveLabel(labelId: string) {
    const label = labels.find((current) => current.id === labelId);

    if (!label) {
      return;
    }

    // Removing an output cascades to the actions on its branch, so confirm when
    // there is something to lose. An empty branch goes straight away.
    if (label.actions.length > 0) {
      const confirmed = await confirm({
        title: "Remove this output?",
        description: `${label.name.trim() || "This output"} and the ${
          label.actions.length
        } action${
          label.actions.length === 1 ? "" : "s"
        } on its branch will be removed from the flow.`,
        confirmLabel: "Remove output",
      });

      if (!confirmed) {
        return;
      }
    }

    removeLabel(labelId);
  }

  /**
   * `insertIndex` is where the action lands in its branch's sequence, which is
   * also where it lands in the drawn chain. Left out, it goes on the end.
   */
  function addAction(
    labelId: string,
    type: WorkflowActionType,
    options: { position?: CanvasNodePosition; insertIndex?: number } = {}
  ) {
    const nextAction = createWorkflowAction(type);
    const label = labels.find((current) => current.id === labelId);
    const actionPosition = clampCanvasPosition(
      options.position ??
        branchActionPosition(
          nodePositions.classifier ?? defaultClassifierPosition,
          labels.findIndex((current) => current.id === labelId),
          label?.actions.length ?? 0
        ),
      nodeBaseHeight
    );

    setNodePositions((current) => ({
      ...current,
      [nextAction.id]: actionPosition,
    }));
    updateLabel(labelId, (label) => {
      const nextActions = [...label.actions];
      const index = Math.min(
        Math.max(options.insertIndex ?? nextActions.length, 0),
        nextActions.length
      );

      nextActions.splice(index, 0, nextAction);

      return { ...label, actions: nextActions };
    });
    setSelectedModule({
      type: "action",
      labelId,
      actionId: nextAction.id,
    });
  }

  function updateAction(
    labelId: string,
    actionId: string,
    updater: (action: WorkflowAction) => WorkflowAction
  ) {
    updateLabel(labelId, (label) => ({
      ...label,
      actions: label.actions.map((action) =>
        action.id === actionId ? updater(action) : action
      ),
    }));
  }

  function removeAction(labelId: string, actionId: string) {
    updateLabel(labelId, (label) => ({
      ...label,
      actions: label.actions.filter((action) => action.id !== actionId),
    }));
    setNodePositions((current) => {
      const next = { ...current };
      delete next[actionId];
      return next;
    });
    setConnectingFrom(null);
    setConnectMenu(null);
    setSelectedModule(null);
  }

  function deleteModule(module: SelectedModule) {
    if (module.type === "action") {
      removeAction(module.labelId, module.actionId);
    }
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
      deleteModuleRef.current(moduleToDelete);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedModule]);

  // The add-node menu closes on Escape or on a click anywhere outside it. Its
  // own handle is exempt so clicking the handle again toggles it shut.
  React.useEffect(() => {
    if (!connectMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest("[data-connect-menu]") ||
        target.closest("[data-connect-handle]")
      ) {
        return;
      }

      setConnectMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConnectMenu(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [connectMenu]);

  /** Re-parents an action onto another output's branch, at the front of it. */
  function moveActionToLabel(actionId: string, labelId: string) {
    let movedAction: WorkflowAction | undefined;

    setLabels((current) => {
      const next = current.map((label) => {
        const action = label.actions.find((item) => item.id === actionId);

        if (!action) {
          return label;
        }

        movedAction = action;
        return {
          ...label,
          actions: label.actions.filter((item) => item.id !== actionId),
        };
      });

      if (!movedAction) {
        return current;
      }

      const actionToMove = movedAction;

      return next.map((label) =>
        label.id === labelId &&
        !label.actions.some((action) => action.id === actionId)
          ? { ...label, actions: [actionToMove, ...label.actions] }
          : label
      );
    });
    setSelectedModule({ type: "action", labelId, actionId });
  }

  function reorderActionAfter(sourceActionId: string, targetActionId: string) {
    setLabels((current) =>
      current.map((label) => {
        const sourceIndex = label.actions.findIndex(
          (action) => action.id === sourceActionId
        );
        const targetIndex = label.actions.findIndex(
          (action) => action.id === targetActionId
        );

        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
          return label;
        }

        const nextActions = [...label.actions];
        const [targetAction] = nextActions.splice(targetIndex, 1);
        const nextSourceIndex = nextActions.findIndex(
          (action) => action.id === sourceActionId
        );
        nextActions.splice(nextSourceIndex + 1, 0, targetAction);

        return { ...label, actions: nextActions };
      })
    );
  }

  function getCanvasPoint(clientX: number, clientY: number) {
    const bounds = canvasRef.current?.getBoundingClientRect();

    if (!bounds) {
      return { x: 0, y: 0 };
    }

    return {
      x: (clientX - bounds.left - view.x) / view.zoom,
      y: (clientY - bounds.top - view.y) / view.zoom,
    };
  }

  /**
   * Which branch a loose action belongs to. An action always runs under one
   * output, so a drop that names no branch is resolved by where it landed:
   * nearest branch first, then whatever branch is already open in the panel.
   */
  function labelIdForDrop(point: CanvasNodePosition) {
    const classifierPosition =
      nodePositions.classifier ?? defaultClassifierPosition;
    const nearest = labels
      .map((label, index) => {
        const tail = label.actions.at(-1);
        const anchor = tail
          ? nodePositions[tail.id] ??
            branchActionPosition(
              classifierPosition,
              index,
              label.actions.length - 1
            )
          : {
              x: classifierPosition.x + nodeWidth,
              y: classifierPosition.y + branchAnchorY(index),
            };

        return {
          label,
          distance: Math.hypot(point.x - anchor.x, point.y - anchor.y),
        };
      })
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearest && nearest.distance < 360) {
      return nearest.label.id;
    }

    if (selectedModule?.type === "action") {
      return selectedModule.labelId;
    }

    return labels[0]?.id;
  }

  function handleWidgetDrop(
    widgetType: PaletteWidgetType,
    point: CanvasNodePosition
  ) {
    const labelId = labelIdForDrop(point);

    if (labelId) {
      addAction(labelId, widgetType, {
        position: {
          x: point.x - nodeWidth / 2,
          y: point.y - nodeBaseHeight / 2,
        },
      });
    }
  }

  /**
   * Slides the board just far enough to bring a node into view, leaving room
   * on the right for the inspector that opens beside it.
   */
  function revealPosition(
    position: CanvasNodePosition,
    nodeHeight: number
  ) {
    const margin = 24;

    if (boardSize.width === 0 || boardSize.height === 0) {
      return;
    }

    setView((current) => {
      // The node's footprint on screen, which shrinks and grows with the zoom
      // even though the panel beside it does not.
      const left = position.x * current.zoom;
      const top = position.y * current.zoom;
      const width = nodeWidth * current.zoom;
      const height = nodeHeight * current.zoom;
      const rightEdge = Math.max(
        width + margin,
        boardSize.width - margin - inspectorWidth - inspectorGap
      );
      let { x, y } = current;

      if (left + x + width > rightEdge) {
        x = rightEdge - left - width;
      }

      if (left + x < margin) {
        x = margin - left;
      }

      if (top + y + height > boardSize.height - margin) {
        y = boardSize.height - margin - height - top;
      }

      if (top + y < margin) {
        y = margin - top;
      }

      return x === current.x && y === current.y ? current : { ...current, x, y };
    });
  }

  // Both are read from effects that must not re-run when the board re-renders.
  const revealPositionRef = React.useRef(revealPosition);
  const canvasNodeMapRef = React.useRef(canvasNodeMap);

  React.useEffect(() => {
    revealPositionRef.current = revealPosition;
    canvasNodeMapRef.current = canvasNodeMap;
  });

  const debugNodeId = debug.isRunning ? debug.step?.nodeId ?? null : null;

  // Stepping the run slides the board to the node the step belongs to, so the
  // panel is never explaining a node that is off screen.
  React.useEffect(() => {
    if (!debugNodeId) {
      return;
    }

    const node = canvasNodeMapRef.current.get(debugNodeId);

    if (node) {
      revealPositionRef.current(node.position, node.height);
    }
  }, [boardSize.height, boardSize.width, debugNodeId]);

  /**
   * A test takes the board over: nothing is edited while it runs, so the
   * inspector, the add-node menu, and the palette all step aside before the
   * watcher starts listening.
   */
  function startDebug() {
    setSelectedModule(null);
    setConnectMenu(null);
    setConnectingFrom(null);
    setIsPaletteOpen(false);
    debug.start();
  }

  /** Where a node stands in the test, or undefined when no test is on. */
  function debugNodeState(nodeId: string): DebugNodeState | undefined {
    // Waiting for mail is the trigger node's job, so it is the node that shows
    // it. Everything else is simply not doing anything yet.
    if (debug.isListening) {
      return nodeId === "trigger" ? "listening" : undefined;
    }

    if (!debug.isRunning || !debug.run) {
      return undefined;
    }

    if (debug.step?.nodeId === nodeId) {
      return "active";
    }

    const index = debug.run.steps.findIndex((item) => item.nodeId === nodeId);

    if (index === -1) {
      // This email never reaches the node — a branch it did not match, or an
      // action under one.
      return "muted";
    }

    return index < debug.stepIndex ? "passed" : "ahead";
  }

  /**
   * Adds the picked action straight after the outlet whose handle opened the
   * menu, so it arrives already wired into that branch's sequence.
   */
  function addNodeAfter(outlet: CanvasOutlet, widgetType: PaletteWidgetType) {
    const position = placeNodeAfter({ outlet, occupied: canvasNodes });

    setConnectMenu(null);
    revealPosition(position, nodeBaseHeight);

    if (outlet.node.kind === "classifier") {
      const labelId =
        outlet.branchIndex === undefined
          ? undefined
          : outlet.node.branches?.[outlet.branchIndex]?.labelId;

      if (labelId) {
        // First on the branch: the new node sits between the classification and
        // whatever used to run first.
        addAction(labelId, widgetType, { position, insertIndex: 0 });
      }

      return;
    }

    if (outlet.node.kind !== "action" || !outlet.node.labelId) {
      return;
    }

    const label = labels.find((current) => current.id === outlet.node.labelId);
    const sourceIndex =
      label?.actions.findIndex((action) => action.id === outlet.node.id) ?? -1;

    addAction(outlet.node.labelId, widgetType, {
      position,
      insertIndex: sourceIndex === -1 ? undefined : sourceIndex + 1,
    });
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
      startPan: view,
    };
    setIsPanning(true);
    setConnectingFrom(null);
    setConnectMenu(null);
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
      nodeHeight: node.height,
      element: event.currentTarget,
      frame: 0,
      nextPosition: node.position,
      moved: false,
    };
    ignoreNodeClick.current = false;
    setConnectMenu(null);
    // Selection waits for the click: pressing to drag a node should move it,
    // not open its inspector.
  }

  /**
   * The click a press leaves behind opens the inspector, unless that press
   * turned into a drag.
   */
  function handleNodeClick(node: FlowCanvasNode) {
    if (ignoreNodeClick.current) {
      ignoreNodeClick.current = false;
      return;
    }

    // During a test a node is not something you open — while a run is stepping
    // it is a step to jump to, if this email went through it at all.
    if (debug.isDebugging) {
      if (debug.isRunning) {
        debug.goToNode(node.id);
      }

      return;
    }

    // The inspector is two columns wide now, so a node near the right edge
    // would open its own settings on top of itself. Slide the board first.
    revealPosition(node.position, node.height);
    setSelectedModule(node.module);
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;

    if (!drag) {
      return;
    }

    if (drag.type === "pan") {
      setView((current) => ({
        ...current,
        x: drag.startPan.x + event.clientX - drag.startClientX,
        y: drag.startPan.y + event.clientY - drag.startClientY,
      }));
      return;
    }

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;

    if (!drag.moved) {
      if (Math.hypot(deltaX, deltaY) < nodeDragThreshold) {
        // Still within the wobble a click carries — leave the node alone.
        return;
      }

      drag.moved = true;
      // Set on the DOM rather than in React state: the node is already moved
      // this way during a drag, and a state flip would re-render the board.
      drag.element.dataset.dragging = "true";
    }

    // The pointer moves in screen pixels; the node lives in board pixels, and
    // the two only line up at 100%.
    drag.nextPosition = clampCanvasPosition(
      {
        x: drag.startPosition.x + deltaX / view.zoom,
        y: drag.startPosition.y + deltaY / view.zoom,
      },
      drag.nodeHeight
    );

    if (drag.frame === 0) {
      drag.frame = window.requestAnimationFrame(() => {
        drag.frame = 0;
        drag.element.style.transform = canvasPositionTransform(
          drag.nextPosition
        );
        syncEdgesToPosition(drag.nodeId, drag.nextPosition);
        syncInspectorToPosition(drag.nodeId, drag.nextPosition);
      });
    }
  }

  /**
   * Redraws the edges that touch the dragged node. The node itself is moved
   * on the DOM during a drag, so the paths are too — committing every frame to
   * React state instead would re-render the whole board on each pointer move.
   */
  function syncEdgesToPosition(nodeId: string, position: CanvasNodePosition) {
    canvasEdges.forEach((edge) => {
      if (edge.from !== nodeId && edge.to !== nodeId) {
        return;
      }

      const path = edgePathRefs.current.get(edgeKey(edge));
      const fromNode = canvasNodeMap.get(edge.from);
      const toNode = canvasNodeMap.get(edge.to);

      if (!path || !fromNode || !toNode) {
        return;
      }

      path.setAttribute(
        "d",
        edgePathDefinition(
          edge.from === nodeId ? { ...fromNode, position } : fromNode,
          edge.to === nodeId ? { ...toNode, position } : toNode,
          edge.fromBranchIndex
        )
      );
    });
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
      floatingPanelPosition({
        nodePosition: position,
        view,
        board: boardSize,
        panelWidth: inspectorPanelWidth,
        panelHeight: inspectorHeight,
      })
    );
  }

  function handleCanvasPointerUp() {
    const drag = dragState.current;

    if (drag?.type === "node" && drag.moved) {
      if (drag.frame !== 0) {
        window.cancelAnimationFrame(drag.frame);
        drag.element.style.transform = canvasPositionTransform(
          drag.nextPosition
        );
        syncEdgesToPosition(drag.nodeId, drag.nextPosition);
        syncInspectorToPosition(drag.nodeId, drag.nextPosition);
      }

      // React never set this attribute, so it will not clear it on re-render.
      delete drag.element.dataset.dragging;
      setNodePositions((current) => ({
        ...current,
        [drag.nodeId]: drag.nextPosition,
      }));
      // The browser still fires a click after the drag; that one is not a
      // request to open the inspector.
      ignoreNodeClick.current = true;
    }

    dragState.current = null;
    setIsPanning(false);
  }

  function handleConnectionTarget(targetNode: FlowCanvasNode) {
    if (!connectingFrom || connectingFrom.node.id === targetNode.id) {
      setConnectingFrom(null);
      return;
    }

    connectCanvasNodes(connectingFrom, targetNode);
    setConnectingFrom(null);
    revealPosition(targetNode.position, targetNode.height);
    setSelectedModule(targetNode.module);
  }

  function connectCanvasNodes(
    outlet: CanvasOutlet,
    targetNode: FlowCanvasNode
  ) {
    if (targetNode.kind !== "action") {
      return;
    }

    if (outlet.node.kind === "classifier") {
      const labelId =
        outlet.branchIndex === undefined
          ? undefined
          : outlet.node.branches?.[outlet.branchIndex]?.labelId;

      if (labelId) {
        moveActionToLabel(targetNode.id, labelId);
      }

      return;
    }

    if (outlet.node.kind === "action") {
      reorderActionAfter(outlet.node.id, targetNode.id);
    }
  }

  function saveDraft() {
    startTransition(() => {
      void (async () => {
        const response = await saveWorkflow({
          id: workflowId,
          status,
          ...draft,
        });

        setResult(response);

        if (response.status === "success" && response.workflow) {
          const savedWorkflow = response.workflow;

          setLastSavedAt(formatWorkflowTimestamp(savedWorkflow.updatedAt));
          // An unnamed workflow is numbered on the server, so the heading only
          // learns its name from the row that came back.
          setWorkflowName(savedWorkflow.draft.name);

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
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

      {/* One line, so the board underneath gets the rest of the viewport. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <InlineEditableText
            value={workflowName}
            onChange={setWorkflowName}
            label="workflow name"
            placeholder={defaultWorkflowNamePrefix}
            className="text-xl font-semibold tracking-normal sm:text-2xl"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {saveHint ? (
            <p className="text-xs text-muted-foreground">{saveHint}</p>
          ) : null}
          {actions}
          <Button
            type="button"
            variant="outline"
            onClick={debug.isDebugging ? debug.stop : startDebug}
          >
            {debug.isDebugging ? (
              <X className="size-4" />
            ) : (
              <FlaskConical className="size-4" />
            )}
            {debug.isDebugging ? "Exit test" : "Test workflow"}
          </Button>
          <Button type="button" onClick={saveDraft} disabled={isPending}>
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
      </div>

      <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
        <div
          ref={canvasRef}
          className={cn(
            // A container so the floating panels lay themselves out against the
            // board's own width, not the viewport's.
            "@container relative min-h-0 flex-1 overflow-hidden bg-background",
            "bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)]",
            // A pan holds the hand over the whole board, so passing under a
            // node mid-drag does not flick the cursor back to an arrow.
            isPanning && "cursor-grabbing"
          )}
          style={{
            // The grid is the board's ruler, so it takes the zoom with it —
            // otherwise the nodes grow and the squares under them do not.
            backgroundSize: `${canvasGridSize * view.zoom}px ${
              canvasGridSize * view.zoom
            }px`,
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleCanvasDrop}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: canvasViewTransform(view),
              // Scaling from the corner keeps board pixels a plain multiple of
              // the zoom, which is what every measurement here assumes.
              transformOrigin: "0 0",
            }}
            onPointerDown={handleCanvasPointerDown}
          >
            <FlowEdges
              edges={canvasEdges}
              nodes={canvasNodeMap}
              registerPath={registerEdgePath}
            />
            {canvasNodes.map((node) => (
              <CanvasNode
                key={node.id}
                node={node}
                selected={moduleKey(selectedModule) === moduleKey(node.module)}
                connecting={connectingFrom?.node.id === node.id}
                canReceiveConnection={Boolean(
                  connectingFrom &&
                    connectingFrom.node.id !== node.id &&
                    node.kind === "action"
                )}
                onPointerDown={(event) => handleNodePointerDown(event, node)}
                onSelect={() => handleNodeClick(node)}
                debugState={debugNodeState(node.id)}
                followedBranchId={
                  debug.isRunning && node.kind === "classifier"
                    ? debug.run?.followedLabelId ?? null
                    : undefined
                }
                // A test is a reading of the board, not an edit of it: the
                // outlets stop offering to add anything while one is running.
                canAddNext={!debug.isDebugging}
                openMenuBranch={
                  connectMenu?.nodeId === node.id
                    ? connectMenu.branchIndex ?? "node"
                    : null
                }
                onToggleMenu={(branchIndex) => {
                  setConnectingFrom(null);
                  setConnectMenu((current) =>
                    current?.nodeId === node.id &&
                    current.branchIndex === branchIndex
                      ? null
                      : { nodeId: node.id, branchIndex }
                  );
                  // One panel at a time: the menu takes the spot the
                  // inspector would float in.
                  setSelectedModule(null);
                }}
                onCompleteConnection={() => handleConnectionTarget(node)}
              />
            ))}
          </div>

          <ZoomControls
            zoom={view.zoom}
            onZoomIn={() => zoomFromButton((current) => current * zoomButtonStep)}
            onZoomOut={() =>
              zoomFromButton((current) => current / zoomButtonStep)
            }
            onReset={() => zoomFromButton(() => 1)}
          />

          {debug.isDebugging ? null : (
            <NodePalette
              open={isPaletteOpen}
              canAddAction={labels.length > 0}
              onOpenChange={setIsPaletteOpen}
              onAddAction={(type) => {
                const labelId = labelIdForDrop({ x: 0, y: 0 });

                if (labelId) {
                  addAction(labelId, type);
                  setIsPaletteOpen(false);
                }
              }}
            />
          )}

          <WorkflowDebugBar debug={debug} />

          {debug.isRunning && debugPanelPosition ? (
            <WorkflowDebugStepPanel
              ref={measureDebugPanel}
              debug={debug}
              position={debugPanelPosition}
              width={debugPanelWidth}
              maxHeight={Math.max(
                200,
                (boardSize.height || defaultInspectorHeight) -
                  inspectorMargin * 2
              )}
            />
          ) : null}

          {connectMenuOutlet && connectMenuPosition ? (
            <NodeConnectMenu
              ref={measureConnectMenu}
              sourceTitle={outletTitle(connectMenuOutlet)}
              options={actionTypes}
              position={connectMenuPosition}
              maxHeight={Math.max(
                200,
                (boardSize.height || defaultConnectMenuHeight) -
                  inspectorMargin * 2
              )}
              onPick={(widgetType) =>
                addNodeAfter(connectMenuOutlet, widgetType)
              }
              onConnectExisting={() => {
                setConnectingFrom(connectMenuOutlet);
                setConnectMenu(null);
              }}
              onClose={() => setConnectMenu(null)}
            />
          ) : null}

          {selectedModule && inspectorPosition ? (
            // Wraps both columns: the data column inserts into the fields the
            // settings column renders. Keyed so switching nodes forgets which
            // field was last focused.
            <VariableInsertProvider key={moduleKey(selectedModule)}>
              <NodeInspector
                ref={inspectorNodeRef}
                module={selectedModule}
                title={moduleTitle(selectedModule, selectedAction)}
                position={inspectorPosition}
                maxHeight={Math.max(
                  200,
                  (boardSize.height || defaultInspectorHeight) -
                    inspectorMargin * 2
                )}
                canDelete={canDeleteModule(selectedModule)}
                onDelete={() => deleteModule(selectedModule)}
                onClose={() => setSelectedModule(null)}
                width={inspectorPanelWidth}
                dataPanel={
                  hasUpstreamData ? (
                    <UpstreamDataPanel upstream={nodeData.upstream} />
                  ) : null
                }
              >
                <div className="space-y-4">
                  {selectedModule.type === "trigger" ? (
                    <TriggerSettings
                      trigger={trigger}
                      onTriggerChange={setTrigger}
                    />
                  ) : null}
                  {selectedModule.type === "classifier" ? (
                    <ClassificationSettings
                      classifierPrompt={classifierPrompt}
                      onClassifierPromptChange={setClassifierPrompt}
                      labels={labels}
                      onAddLabel={addLabel}
                      onRenameLabel={(labelId, name) =>
                        updateLabel(labelId, (label) => ({ ...label, name }))
                      }
                      onRemoveLabel={(labelId) =>
                        void confirmRemoveLabel(labelId)
                      }
                    />
                  ) : null}
                  {selectedModule.type === "action" &&
                  selectedLabel &&
                  selectedAction ? (
                    <ActionSettings
                      action={selectedAction}
                      onChange={(updater) =>
                        updateAction(
                          selectedLabel.id,
                          selectedAction.id,
                          updater
                        )
                      }
                    />
                  ) : null}
                  {nodeData.own ? (
                    <NodeOutputSummary own={nodeData.own} />
                  ) : null}
                </div>
              </NodeInspector>
            </VariableInsertProvider>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog />
      <WorkflowDebugDialog debug={debug} />
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
 * The board's zoom readout, in the corner opposite the add-node button. The
 * gesture is the primary control — pinch the trackpad — so these are a small
 * floating toolbar rather than anything that competes with the board.
 *
 * The percentage doubles as the reset: clicking it puts the board back to 100%.
 */
function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const percent = Math.round(zoom * 100);

  return (
    <div
      data-canvas-overlay
      className="absolute right-3 top-3 z-30 flex items-center gap-0.5 rounded-lg border bg-card p-1 shadow-lg"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onZoomOut}
        disabled={zoom <= minZoom + zoomEpsilon}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 min-w-14 px-2 text-xs tabular-nums"
        onClick={onReset}
        disabled={percent === 100}
        aria-label={`Zoom is ${percent} percent. Reset to 100 percent.`}
        title="Reset zoom to 100%"
      >
        {percent}%
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onZoomIn}
        disabled={zoom >= maxZoom - zoomEpsilon}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

/**
 * The board's own add-node control: a button in the bottom-right corner that
 * expands into the list of nodes you can click or drag onto the board.
 */
function NodePalette({
  open,
  canAddAction,
  onOpenChange,
  onAddAction,
}: {
  open: boolean;
  /** False until the classification has an output for an action to sit under. */
  canAddAction: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAction: (type: WorkflowActionType) => void;
}) {
  return (
    <div
      // Spans the board's height so a tall list scrolls instead of being
      // clipped, but only the panel and the button take clicks. It starts
      // below the zoom controls rather than growing up into them.
      className="pointer-events-none absolute bottom-3 right-3 top-16 z-30 flex max-w-[calc(100%-1.5rem)] flex-col items-end justify-end gap-2"
    >
      {open ? (
        <div
          data-canvas-overlay
          className="pointer-events-auto min-h-0 w-64 max-w-full overflow-y-auto rounded-lg border bg-card p-2 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <span className="text-sm font-medium">Add an action</span>
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
                  disabledHint="Add an output to the classification first"
                  onAdd={() => onAddAction(type)}
                />
              );
            })}
          </div>
          <p className="px-1 pt-2 text-xs text-muted-foreground">
            {canAddAction
              ? "Click to drop it on the nearest branch, or drag it where you want it."
              : "Open the classification node and add an output first — actions run on a branch."}
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
  draggable = true,
  role,
  onAdd,
}: {
  title: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  widgetType?: PaletteWidgetType;
  disabled?: boolean;
  disabledHint?: string;
  /** The connect menu reuses this row but has nowhere to drop a drag. */
  draggable?: boolean;
  role?: string;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      role={role}
      draggable={draggable && !disabled}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      onClick={onAdd}
      onDragStart={(event) => {
        if (!draggable || !widgetType) {
          return;
        }

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
      {draggable ? (
        <Grip className="size-4 shrink-0 text-muted-foreground" />
      ) : null}
    </button>
  );
}

/**
 * The list a node's output handle opens. Picking from it adds the node and
 * wires it in straight after the node the menu belongs to.
 */
function NodeConnectMenu({
  ref,
  sourceTitle,
  options,
  position,
  maxHeight,
  onPick,
  onConnectExisting,
  onClose,
}: {
  ref: React.Ref<HTMLDivElement>;
  sourceTitle: string;
  options: PaletteWidgetType[];
  /** Board-relative pixels, already flipped and clamped to stay on screen. */
  position: CanvasNodePosition;
  maxHeight: number;
  onPick: (widgetType: PaletteWidgetType) => void;
  onConnectExisting: () => void;
  onClose: () => void;
}) {
  return (
    <div
      ref={ref}
      role="menu"
      data-connect-menu
      data-canvas-overlay
      aria-label={`Add a node after ${sourceTitle}`}
      className="absolute left-0 top-0 z-40 flex max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border bg-card shadow-xl duration-150 animate-in fade-in-0 zoom-in-95"
      style={{
        width: connectMenuWidth,
        maxHeight,
        transform: canvasPositionTransform(position),
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Add next action</p>
          <p className="truncate text-xs text-muted-foreground">
            After {sourceTitle}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClose}
          aria-label="Close the node list"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {options.map((option) => (
          <PaletteItem
            key={option}
            role="menuitem"
            title={actionLabels[option]}
            detail="Action node"
            icon={actionIcons[option]}
            draggable={false}
            onAdd={() => onPick(option)}
          />
        ))}
        <PaletteItem
          role="menuitem"
          title="Connect an existing action"
          detail="Pick an action already on the board"
          icon={Link2}
          draggable={false}
          onAdd={onConnectExisting}
        />
      </div>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        The new action is connected next in the sequence.
      </p>
    </div>
  );
}

/**
 * Settings for the selected node, floating right beside that node like a
 * popover rather than docking to the side of the page.
 *
 * Two columns under one header: the values earlier steps produced on the left,
 * everything about the selected node — its settings, then what it outputs in
 * turn — on the right. Reading left to right is the shape of the work: take a
 * value from what came before, put it into this step.
 */
function NodeInspector({
  ref,
  module,
  title,
  position,
  width,
  maxHeight,
  canDelete,
  dataPanel,
  onDelete,
  onClose,
  children,
}: {
  ref: React.Ref<HTMLDivElement>;
  module: SelectedModule;
  title: string;
  /** Board-relative pixels, already flipped and clamped to stay on screen. */
  position: CanvasNodePosition;
  width: number;
  maxHeight: number;
  canDelete: boolean;
  /** The upstream data column, or null for a node with nothing before it. */
  dataPanel: React.ReactNode;
  onDelete: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      role="dialog"
      data-canvas-overlay
      aria-label={`${moduleLabel(module)} settings`}
      className="absolute left-0 top-0 z-40 flex max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border bg-card shadow-xl duration-150 animate-in fade-in-0 zoom-in-95"
      style={{
        width,
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
      <div className="flex min-h-0 flex-1">
        {dataPanel ? (
          // A quieter surface than the settings beside it, so the column reads
          // as material to draw from rather than another set of controls.
          <div
            className="flex min-h-0 shrink-0 flex-col border-r bg-muted/30"
            style={{ width: inspectorDataWidth }}
          >
            {dataPanel}
          </div>
        ) : null}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
          {children}
        </div>
      </div>
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

/**
 * A node on the board says what it is: an icon and a name, nothing else. What
 * it is set to is a question the settings panel answers, and a board that
 * answered it too would be a board nobody can scan.
 *
 * The classification node carries one extra thing, because it is the one node
 * whose shape the user decides: a row per output label, each with the outlet
 * its branch leaves from.
 */
function CanvasNode({
  node,
  selected,
  connecting,
  canReceiveConnection,
  canAddNext,
  openMenuBranch,
  debugState,
  followedBranchId,
  onPointerDown,
  onSelect,
  onToggleMenu,
  onCompleteConnection,
}: {
  node: FlowCanvasNode;
  selected: boolean;
  connecting: boolean;
  canReceiveConnection: boolean;
  /** False while a test is running, which hides every outlet's plus. */
  canAddNext: boolean;
  /** Which outlet has the add-node menu open: a branch index, or the node. */
  openMenuBranch: number | "node" | null;
  /** Set only while a test run is stepping through the board. */
  debugState?: DebugNodeState;
  /** Classification node, during a run: the branch this email took. */
  followedBranchId?: string | null;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onToggleMenu: (branchIndex?: number) => void;
  onCompleteConnection: () => void;
}) {
  const Icon = node.icon;
  /** The workflow always starts here, so the node wears a soft brand halo. */
  const isInitialNode = node.kind === "trigger";
  // Only an action can be followed by another node from the node's own edge.
  // The classification branches out from its rows instead, and the trigger's
  // one link — to the classification — is fixed.
  const showNodeHandle = canAddNext && node.kind === "action";

  return (
    <div
      role="button"
      tabIndex={0}
      // Named explicitly so the handles nested inside it do not end up in the
      // node's own accessible name.
      aria-label={`${moduleLabel(node.module)}: ${node.title}${
        node.needs ? `. ${node.needs}` : ""
      }`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute rounded-md border bg-card text-card-foreground shadow-sm",
        // Not `transition-all`: the position is a transform written straight to
        // the DOM every frame of a drag, and easing that would lag the pointer.
        "transition-[background-color,border-color,box-shadow,color]",
        "select-none",
        // The trigger's idle glow animates box-shadow, which would outrank the
        // drag ring below — so it steps aside while the node is being dragged.
        // The halo also steps aside for a test run, where the lit node is
        // whichever step the run is on.
        isInitialNode &&
          !debugState &&
          "border-primary/45 not-data-[dragging=true]:motion-safe:animate-brand-glow-pulse not-data-[dragging=true]:motion-reduce:shadow-[0_0_0_1px_var(--brand-glow),0_0_22px_-6px_var(--brand-glow)]",
        selected && "border-primary shadow-md ring-2 ring-primary/20",
        connecting && "border-primary bg-primary/10",
        canReceiveConnection && "ring-2 ring-muted-foreground/20",
        // A run reads as a path across the board: the step it is on is lit, the
        // nodes this email never reached recede.
        debugState === "listening" &&
          "border-primary shadow-md ring-2 ring-primary/30 not-data-[dragging=true]:motion-safe:animate-brand-glow-pulse not-data-[dragging=true]:motion-reduce:shadow-[0_0_0_1px_var(--brand-glow),0_0_22px_-6px_var(--brand-glow)]",
        debugState === "active" &&
          "border-primary shadow-md ring-2 ring-primary/30",
        debugState === "passed" && "border-success/50",
        debugState === "muted" && "opacity-40",
        // Set on the DOM by the drag handlers, not by React. A dragged node
        // lifts off the board: brand ring, deeper shadow, and above its
        // neighbours so it never slides underneath one. The hand appears with
        // it — the attribute is only set once a press clears the drag
        // threshold, so a plain click never changes the cursor.
        "data-[dragging=true]:z-20 data-[dragging=true]:cursor-grabbing data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5 data-[dragging=true]:shadow-lg data-[dragging=true]:ring-2 data-[dragging=true]:ring-primary/35"
      )}
      style={{
        width: nodeWidth,
        height: node.height,
        transform: canvasPositionTransform(node.position),
      }}
    >
      {node.kind === "action" ? (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onCompleteConnection();
          }}
          style={{ top: nodeBaseHeight / 2 }}
          className={cn(
            "absolute left-0 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background transition",
            canReceiveConnection
              ? "border-primary ring-4 ring-primary/15"
              : "border-border"
          )}
          aria-label={`Connect to ${node.title}`}
          title={`Connect to ${node.title}`}
        />
      ) : null}

      {showNodeHandle ? (
        <ConnectHandle
          open={openMenuBranch === "node"}
          connecting={connecting}
          offsetY={nodeBaseHeight / 2}
          label={`Add an action after ${node.title}`}
          onToggle={() => onToggleMenu()}
        />
      ) : null}

      <div
        className="flex items-center gap-2.5 px-3"
        style={{ height: nodeBaseHeight }}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
            isInitialNode && "bg-primary/15 ring-1 ring-primary/25"
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {node.title}
        </span>
        {/* During a run the marker reports the run, not the draft: whether the
            node is configured is a question for when you are editing it. */}
        {debugState ? (
          <Badge
            variant={debugBadge[debugState].variant}
            className="shrink-0"
          >
            {debugBadge[debugState].label}
          </Badge>
        ) : node.needs ? (
          <TriangleAlert
            aria-hidden="true"
            className="size-3.5 shrink-0 text-warning"
          />
        ) : null}
      </div>

      {node.branches ? (
        <div style={{ paddingBottom: branchListPaddingBottom }}>
          {node.branches.length === 0 ? (
            <div
              className="flex items-center justify-end px-3 text-xs text-muted-foreground"
              style={{ height: branchRowHeight }}
            >
              No outputs yet
            </div>
          ) : null}
          {node.branches.map((branch, index) => {
            // While a run is on, the branch it took is the only one in focus —
            // the rest are paths this email was never going to follow.
            const receded =
              followedBranchId !== undefined &&
              branch.labelId !== followedBranchId;

            return (
              <div
                key={branch.labelId}
                className="relative flex items-center justify-end pl-12 pr-3"
                style={{ height: branchRowHeight }}
              >
                <span
                  className={cn(
                    "truncate text-xs transition-opacity",
                    branch.name
                      ? "text-muted-foreground"
                      : "italic text-muted-foreground/70",
                    receded && "opacity-40"
                  )}
                >
                  {branch.name || "Unnamed output"}
                </span>
                {canAddNext ? (
                  <ConnectHandle
                    open={openMenuBranch === index}
                    connecting={connecting}
                    label={`Add an action to the ${
                      branch.name || "unnamed"
                    } branch`}
                    onToggle={() => onToggleMenu(index)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * What a node's marker says while a run is stepping through. "Running" is a
 * true live state, which is why it is the one that takes the accent.
 */
const debugBadge = {
  listening: { label: "Listening", variant: "default" },
  active: { label: "Running", variant: "default" },
  passed: { label: "Done", variant: "secondary" },
  ahead: { label: "Next up", variant: "outline" },
  muted: { label: "Not reached", variant: "outline" },
} satisfies Record<
  DebugNodeState,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
>;

/**
 * The outlet an edge leaves from, and the button that adds what comes next.
 * Positioned against whatever it is nested in unless `offsetY` places it
 * against the node instead.
 */
function ConnectHandle({
  open,
  connecting,
  offsetY,
  label,
  onToggle,
}: {
  open: boolean;
  connecting: boolean;
  offsetY?: number;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-connect-handle
      data-open={open}
      aria-haspopup="menu"
      aria-expanded={open}
      // The handle is its own control: pressing it must not start a node drag
      // or select the node underneath.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      style={offsetY === undefined ? undefined : { top: offsetY }}
      className={cn(
        "group/handle absolute right-0 z-10 flex size-4 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border bg-background text-primary transition-all",
        offsetY === undefined && "top-1/2",
        "hover:size-6 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md",
        "focus-visible:size-6 focus-visible:border-primary focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[open=true]:size-6 data-[open=true]:border-primary data-[open=true]:bg-primary data-[open=true]:text-primary-foreground data-[open=true]:shadow-md",
        connecting && !open && "border-primary ring-4 ring-primary/15"
      )}
      aria-label={label}
      title={label}
    >
      <Plus
        aria-hidden="true"
        className={cn(
          "size-3.5 scale-0 opacity-0 transition-transform duration-150",
          "group-hover/handle:scale-100 group-hover/handle:opacity-100",
          "group-focus-visible/handle:scale-100 group-focus-visible/handle:opacity-100",
          "group-data-[open=true]/handle:scale-100 group-data-[open=true]/handle:opacity-100"
        )}
      />
    </button>
  );
}

function FlowEdges({
  edges,
  nodes,
  registerPath,
}: {
  edges: CanvasEdge[];
  nodes: Map<string, FlowCanvasNode>;
  /** Hands each path to the board so a node drag can redraw it directly. */
  registerPath: (key: string, element: SVGPathElement | null) => void;
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

        const key = edgeKey(edge);

        return (
          <path
            key={key}
            ref={(element) => {
              registerPath(key, element);

              return () => registerPath(key, null);
            }}
            d={edgePathDefinition(fromNode, toNode, edge.fromBranchIndex)}
            className="fill-none stroke-current stroke-[2]"
            markerEnd="url(#workflow-builder-arrow)"
          />
        );
      })}
    </svg>
  );
}

function edgeKey(edge: CanvasEdge) {
  return `${edge.from}-${edge.to}`;
}

/**
 * The curve between two nodes, from the right edge of one to the left edge of
 * the next. Shared so a dragged node's edges are redrawn exactly as React
 * would draw them once the drag is committed.
 *
 * An edge leaving a classification branch starts at that branch's row rather
 * than at the middle of the node, so the fan-out reads as one outlet per label.
 */
function edgePathDefinition(
  fromNode: { position: CanvasNodePosition; height: number },
  toNode: { position: CanvasNodePosition },
  fromBranchIndex?: number
) {
  const from = {
    x: fromNode.position.x + nodeWidth,
    y:
      fromNode.position.y +
      (fromBranchIndex === undefined
        ? fromNode.height / 2
        : branchAnchorY(fromBranchIndex)),
  };
  const to = {
    x: toNode.position.x,
    // Every node an edge lands on is a plain one-line node, so its inlet is
    // always half a base node down.
    y: toNode.position.y + nodeBaseHeight / 2,
  };
  const bend = Math.max(72, Math.abs(to.x - from.x) * 0.42);

  return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${
    to.x - bend
  } ${to.y}, ${to.x} ${to.y}`;
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

/** Only the spine is placed up front; branches are laid out from it. */
function createInitialNodePositions(): CanvasPositions {
  return {
    trigger: { ...defaultTriggerPosition },
    classifier: { ...defaultClassifierPosition },
  };
}

/** Where a branch's `actionIndex`-th action lands before anyone drags it. */
function branchActionPosition(
  classifierPosition: CanvasNodePosition,
  branchIndex: number,
  actionIndex: number
) {
  return {
    x:
      classifierPosition.x +
      nodeWidth +
      autoPlaceGap +
      Math.max(actionIndex, 0) * (nodeWidth + autoPlaceGap),
    y:
      classifierPosition.y +
      branchAnchorY(Math.max(branchIndex, 0)) -
      nodeBaseHeight / 2,
  };
}

/** How far down the classification node its `index`-th outlet sits. */
function branchAnchorY(index: number) {
  return nodeBaseHeight + index * branchRowHeight + branchRowHeight / 2;
}

function classifierNodeHeight(branchCount: number) {
  // An empty classification still shows one row — the "no outputs yet" line —
  // so the node never collapses to something that looks finished.
  return (
    nodeBaseHeight +
    Math.max(branchCount, 1) * branchRowHeight +
    branchListPaddingBottom
  );
}

function createCanvasNodes({
  trigger,
  classifierPrompt,
  labels,
  nodePositions,
}: {
  trigger: string;
  classifierPrompt: string;
  labels: ClassificationLabel[];
  nodePositions: CanvasPositions;
}) {
  const classifierPosition =
    nodePositions.classifier ?? defaultClassifierPosition;
  const usableLabels = usableClassificationLabels(labels);
  const nodes: FlowCanvasNode[] = [
    {
      id: "trigger",
      kind: "trigger",
      module: { type: "trigger" },
      title: "Email watcher",
      icon: Inbox,
      position: nodePositions.trigger ?? defaultTriggerPosition,
      height: nodeBaseHeight,
      ready: Boolean(trigger.trim()),
    },
  ];

  // Trigger → classification is the fixed spine of every workflow, so both are
  // on the board from the start rather than arriving with the first branch.
  nodes.push({
    id: "classifier",
    kind: "classifier",
    module: { type: "classifier" },
    title: "Classification",
    icon: Sparkles,
    position: classifierPosition,
    height: classifierNodeHeight(labels.length),
    branches: labels.map((label) => ({
      labelId: label.id,
      name: label.name.trim(),
    })),
    ready: Boolean(classifierPrompt.trim()) && usableLabels.length > 0,
    needs: classificationNeeds(classifierPrompt, labels, usableLabels),
  });

  labels.forEach((label, branchIndex) => {
    label.actions.forEach((action, actionIndex) => {
      nodes.push({
        id: action.id,
        kind: "action",
        module: {
          type: "action",
          labelId: label.id,
          actionId: action.id,
        },
        title: actionLabels[action.type],
        icon: actionIcons[action.type],
        position: clampCanvasPosition(
          nodePositions[action.id] ??
            branchActionPosition(classifierPosition, branchIndex, actionIndex),
          nodeBaseHeight
        ),
        height: nodeBaseHeight,
        ready: actionIsReady(action),
        needs: actionIsReady(action) ? undefined : actionNeeds(action),
        labelId: label.id,
        actionId: action.id,
        actionType: action.type,
      });
    });
  });

  return nodes;
}

/** What the classification node's warning marker is warning about. */
function classificationNeeds(
  classifierPrompt: string,
  labels: ClassificationLabel[],
  usableLabels: ClassificationLabel[]
) {
  if (!classifierPrompt.trim()) {
    return "Needs a prompt";
  }

  if (usableLabels.length === 0) {
    return "Needs at least one named output";
  }

  if (usableLabels.length < labels.length) {
    return "Some outputs are unnamed or repeated";
  }

  return undefined;
}

function createCanvasEdges(labels: ClassificationLabel[]) {
  const edges: CanvasEdge[] = [{ from: "trigger", to: "classifier" }];

  labels.forEach((label, branchIndex) => {
    label.actions.forEach((action, actionIndex) => {
      edges.push(
        actionIndex === 0
          ? { from: "classifier", to: action.id, fromBranchIndex: branchIndex }
          : { from: label.actions[actionIndex - 1].id, to: action.id }
      );
    });
  });

  return edges;
}

/**
 * What the selected node's data panel shows: the outputs of every node the run
 * passed through to get here, plus the outputs this node adds for the nodes
 * after it.
 */
function nodeDataGroups({
  node,
  nodes,
  parents,
}: {
  node: FlowCanvasNode;
  nodes: Map<string, FlowCanvasNode>;
  parents: Map<string, string>;
}): { upstream: NodeOutputGroup[]; own: NodeOutputGroup | null } {
  const chain: FlowCanvasNode[] = [];
  const seen = new Set<string>();
  let current: FlowCanvasNode | undefined = node;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);

    const parentId = parents.get(current.id);

    current = parentId ? nodes.get(parentId) : undefined;
  }

  const steps = chain.flatMap((chainNode) => {
    const variableNode = variableChainNode(chainNode);

    return variableNode ? [{ node: chainNode, variableNode }] : [];
  });
  const fieldsByNode = chainOutputFields(steps.map((step) => step.variableNode));
  const groups: NodeOutputGroup[] = steps.map((step) => ({
    nodeId: step.node.id,
    title: chainNodeOutputTitle(step.variableNode),
    kindLabel: moduleLabel(step.node.module),
    fields: fieldsByNode.get(step.node.id) ?? [],
  }));
  const last = groups.at(-1);
  const own =
    last && last.nodeId === node.id && last.fields.length > 0 ? last : null;

  return {
    upstream: groups
      .filter((group) => group.nodeId !== node.id)
      .filter((group) => group.fields.length > 0),
    own,
  };
}

function variableChainNode(node: FlowCanvasNode): VariableChainNode | null {
  if (node.kind === "action") {
    return node.actionType
      ? { id: node.id, kind: "action", actionType: node.actionType }
      : null;
  }

  return { id: node.id, kind: node.kind };
}

function clampCanvasPosition(
  position: CanvasNodePosition,
  nodeHeight: number
) {
  return {
    x: Math.min(Math.max(position.x, 24), canvasWidth - nodeWidth - 24),
    y: Math.min(Math.max(position.y, 24), canvasHeight - nodeHeight - 24),
  };
}

function isPaletteWidgetType(value: string): value is PaletteWidgetType {
  return actionTypes.includes(value as WorkflowActionType);
}

function moduleKey(module: SelectedModule | null) {
  if (!module) {
    return "none";
  }

  if (module.type === "action") {
    return `${module.type}:${module.labelId}:${module.actionId}`;
  }

  return module.type;
}

function canvasPositionTransform(position: CanvasNodePosition) {
  return `translate3d(${position.x}px, ${position.y}px, 0)`;
}

function canvasViewTransform(view: CanvasView) {
  return `${canvasPositionTransform(view)} scale(${view.zoom})`;
}

function clampZoom(zoom: number) {
  return Math.min(Math.max(zoom, minZoom), maxZoom);
}

/**
 * Scales the board around a point given in board-container pixels, so whatever
 * sits under that point — the pinching fingers, or the middle of the view —
 * stays exactly where it was while everything else moves away from it.
 */
function zoomView(
  view: CanvasView,
  focal: CanvasNodePosition,
  nextZoom: number
): CanvasView {
  const zoom = clampZoom(nextZoom);

  if (zoom === view.zoom) {
    return view;
  }

  const scale = zoom / view.zoom;

  return {
    x: focal.x - (focal.x - view.x) * scale,
    y: focal.y - (focal.y - view.y) * scale,
    zoom,
  };
}

/** Wheel deltas arrive in pixels, lines, or pages depending on the device. */
function wheelDelta(event: WheelEvent) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;

  return { x: event.deltaX * unit, y: event.deltaY * unit };
}

/**
 * Turns a pinch into a scale factor. Exponential so the gesture feels the same
 * whether the board is at 40% or 200%, and capped per event because a mouse
 * wheel held down with Ctrl reports far bigger jumps than a trackpad does.
 */
function wheelZoomFactor(deltaY: number) {
  return Math.exp(-Math.min(Math.max(deltaY, -80), 80) / 200);
}

/**
 * Only the nodes a workflow can live without can be deleted from the board. An
 * output is not one of them — it is a setting of the classification node, and
 * it is removed where it is named.
 */
function canDeleteModule(module: SelectedModule) {
  return module.type === "action";
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
 * Places a floating panel beside its node in board pixels: to the right when
 * it fits, flipped to the left when it does not, then nudged back inside the
 * board so it is never half off the edge.
 */
function floatingPanelPosition({
  nodePosition,
  view,
  board,
  panelWidth,
  panelHeight,
}: {
  nodePosition: CanvasNodePosition;
  view: CanvasView;
  board: { width: number; height: number };
  panelWidth: number;
  panelHeight: number;
}): CanvasNodePosition {
  // The panel floats over the board rather than inside it, so it is never
  // scaled — only the node it points at is, and that is what has to be
  // converted from board pixels to the ones the panel is placed in.
  const nodeLeft = nodePosition.x * view.zoom + view.x;
  const nodeTop = nodePosition.y * view.zoom + view.y;
  const rightX = nodeLeft + nodeWidth * view.zoom + inspectorGap;
  const leftX = nodeLeft - inspectorGap - panelWidth;

  let x = rightX;

  if (
    board.width > 0 &&
    rightX + panelWidth > board.width - inspectorMargin &&
    leftX >= inspectorMargin
  ) {
    x = leftX;
  }

  if (board.width > 0) {
    const maxX = Math.max(
      inspectorMargin,
      board.width - panelWidth - inspectorMargin
    );

    x = Math.min(Math.max(x, inspectorMargin), maxX);
  }

  let y = nodeTop;

  if (board.height > 0) {
    const maxY = Math.max(
      inspectorMargin,
      board.height - panelHeight - inspectorMargin
    );

    y = Math.min(Math.max(y, inspectorMargin), maxY);
  }

  return { x, y };
}

/**
 * Measures a floating panel as it mounts and resizes, so the placement maths
 * knows how much room the panel actually needs.
 */
function useMeasuredHeight(defaultHeight: number) {
  const [height, setHeight] = React.useState(defaultHeight);
  const measure = React.useCallback((node: HTMLDivElement) => {
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return { height, measure };
}

/** Board pixels of the point an outlet's menu and edges hang from. */
function outletPosition(outlet: CanvasOutlet): CanvasNodePosition {
  if (outlet.branchIndex === undefined) {
    return outlet.node.position;
  }

  return {
    x: outlet.node.position.x,
    y:
      outlet.node.position.y +
      branchAnchorY(outlet.branchIndex) -
      nodeBaseHeight / 2,
  };
}

/** How an outlet is named in the menu it opens, e.g. "the Sales branch". */
function outletTitle(outlet: CanvasOutlet) {
  if (outlet.branchIndex === undefined) {
    return outlet.node.title;
  }

  const branch = outlet.node.branches?.[outlet.branchIndex];

  return branch?.name ? `the ${branch.name} branch` : "this branch";
}

/**
 * Drops the new node to the right of the outlet it was added from, stepping it
 * out of the way of anything already sitting there.
 */
function placeNodeAfter({
  outlet,
  occupied,
}: {
  outlet: CanvasOutlet;
  occupied: FlowCanvasNode[];
}) {
  const taken = occupied
    .filter((node) => node.id !== outlet.node.id)
    .map((node) => ({ height: node.height, position: node.position }));
  const anchor = outletPosition(outlet);
  const base = {
    x: outlet.node.position.x + nodeWidth + autoPlaceGap,
    y: anchor.y,
  };
  // Straight across first, then alternating below and above it.
  const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4];

  for (const offset of offsets) {
    const candidate = clampCanvasPosition(
      { x: base.x, y: base.y + offset * autoPlaceStep },
      nodeBaseHeight
    );

    if (
      !taken.some((other) =>
        nodesOverlap(candidate, nodeBaseHeight, other.position, other.height)
      )
    ) {
      return candidate;
    }
  }

  return clampCanvasPosition(base, nodeBaseHeight);
}

function nodesOverlap(
  a: CanvasNodePosition,
  aHeight: number,
  b: CanvasNodePosition,
  bHeight: number
) {
  const gap = 16;

  return (
    a.x < b.x + nodeWidth + gap &&
    a.x + nodeWidth + gap > b.x &&
    a.y < b.y + bHeight + gap &&
    a.y + aHeight + gap > b.y
  );
}

function moduleTitle(
  module: SelectedModule,
  action: WorkflowAction | undefined
) {
  if (module.type === "trigger") {
    return "Email watcher";
  }

  if (module.type === "classifier") {
    return "Classification";
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

/**
 * The two halves of one decision: what the model is asked, and what it is
 * allowed to answer.
 *
 * The outputs are not a hint to the model — they are the answer set the call is
 * decoded against, so a workflow with Sales / FAQ / Important gets back one of
 * those three and never a fourth thing. Each one is also a branch on the board,
 * which is why adding an output changes the shape of the node behind this
 * panel.
 */
function ClassificationSettings({
  classifierPrompt,
  onClassifierPromptChange,
  labels,
  onAddLabel,
  onRenameLabel,
  onRemoveLabel,
}: {
  classifierPrompt: string;
  onClassifierPromptChange: (value: string) => void;
  labels: ClassificationLabel[];
  onAddLabel: () => void;
  onRenameLabel: (labelId: string, name: string) => void;
  onRemoveLabel: (labelId: string) => void;
}) {
  const duplicated = duplicateLabelIds(labels);
  const usableLabels = usableClassificationLabels(labels);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="classification-prompt">Prompt</Label>
        <VariableTextarea
          id="classification-prompt"
          fieldLabel="Prompt"
          value={classifierPrompt}
          onValueChange={onClassifierPromptChange}
          placeholder="Describe how to tell these emails apart."
          className="min-h-32"
        />
      </div>

      <div className="space-y-2">
        <Label>Outputs</Label>
        <p className="text-xs text-muted-foreground">
          The model has to answer with one of these, and each one gets its own
          branch on the board.
        </p>
        <div className="space-y-2">
          {labels.map((label, index) => (
            <div key={label.id} className="flex items-center gap-2">
              <Input
                value={label.name}
                aria-label={`Output ${index + 1}`}
                aria-invalid={duplicated.has(label.id)}
                placeholder="Sales"
                onChange={(event) => onRenameLabel(label.id, event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onRemoveLabel(label.id)}
                aria-label={`Remove ${label.name.trim() || `output ${index + 1}`}`}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        {duplicated.size > 0 ? (
          <p className="text-xs text-destructive">
            Two outputs share a name. Repeated names would send the same answer
            down two branches.
          </p>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onAddLabel}>
          <Plus className="size-4" />
          Add output
        </Button>
      </div>

      <ClassificationTest
        classifierPrompt={classifierPrompt}
        labels={usableLabels.map((label) => label.name.trim())}
      />
    </div>
  );
}

/** Names claimed more than once, which the model could not be split between. */
function duplicateLabelIds(labels: ClassificationLabel[]) {
  const byName = new Map<string, string[]>();

  labels.forEach((label) => {
    const name = label.name.trim().toLowerCase();

    if (!name) {
      return;
    }

    byName.set(name, [...(byName.get(name) ?? []), label.id]);
  });

  return new Set(
    Array.from(byName.values())
      .filter((ids) => ids.length > 1)
      .flat()
  );
}

/**
 * One classification run against a made-up email. The prompt is a piece of
 * writing, and writing is checked by reading what it did — not by saving the
 * workflow and waiting for real mail to arrive.
 */
function ClassificationTest({
  classifierPrompt,
  labels,
}: {
  classifierPrompt: string;
  /** Already trimmed and de-duplicated: exactly what the model is held to. */
  labels: string[];
}) {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [result, setResult] = React.useState<
    Awaited<ReturnType<typeof testClassification>> | null
  >(null);
  const [isPending, startTransition] = React.useTransition();
  const resultRef = React.useRef<HTMLDivElement>(null);
  const canRun = Boolean(classifierPrompt.trim()) && labels.length > 0;

  // The panel is taller than the board it floats over, so an answer that
  // arrives below the fold looks like a button that did nothing.
  React.useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [result]);

  function runTest() {
    startTransition(() => {
      void (async () => {
        setResult(
          await testClassification({
            prompt: classifierPrompt,
            labels,
            subject,
            body,
          })
        );
      })();
    });
  }

  return (
    <Collapsible className="overflow-hidden rounded-md border border-dashed">
      <CollapsibleTrigger className="group/test flex w-full items-center gap-2 px-2 py-1.5 text-left transition hover:bg-muted/60">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/test:rotate-90" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            Try it on an email
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            Runs the real classification once
          </span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t p-2">
        <div className="space-y-2">
          <Label htmlFor="classification-test-subject">Subject</Label>
          <Input
            id="classification-test-subject"
            value={subject}
            placeholder="Re: pricing for 40 seats"
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="classification-test-body">Body</Label>
          <Textarea
            id="classification-test-body"
            value={body}
            placeholder="Paste an email you would want sorted."
            className="min-h-24"
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!canRun || isPending}
          title={
            canRun ? undefined : "Write a prompt and name an output first."
          }
          onClick={runTest}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Run classification
        </Button>

        {result?.status === "success" ? (
          <div
            ref={resultRef}
            className="space-y-1.5 rounded-md border bg-muted/40 px-2 py-1.5"
          >
            <div className="flex items-center gap-2">
              <Badge>{result.classification.label}</Badge>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(result.classification.confidence * 100)}% confident
              </span>
            </div>
            {result.classification.reasoning ? (
              <p className="text-xs text-muted-foreground">
                {result.classification.reasoning}
              </p>
            ) : null}
          </div>
        ) : null}
        {result?.status === "error" ? (
          <Alert ref={resultRef} variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertTitle>{result.title}</AlertTitle>
            <AlertDescription>{result.description}</AlertDescription>
          </Alert>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
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
        <VariableInput
          id={`${actionId}-label`}
          fieldLabel="Tag"
          value={action.labelName}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              labelName: value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-label-note`}>Note</Label>
        <VariableInput
          id={`${actionId}-label-note`}
          fieldLabel="Note"
          value={action.note}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              note: value,
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
        <VariableInput
          id={`${actionId}-forward-to`}
          fieldLabel="Forward to"
          // Not `type="email"`: the address can be a variable from an earlier
          // step, such as the sender's reply-to.
          inputMode="email"
          value={action.forwardTo}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              forwardTo: value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-subject-prefix`}>Subject prefix</Label>
        <VariableInput
          id={`${actionId}-subject-prefix`}
          fieldLabel="Subject prefix"
          value={action.subjectPrefix}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              subjectPrefix: value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-forward-note`}>Forward note</Label>
        <VariableTextarea
          id={`${actionId}-forward-note`}
          fieldLabel="Forward note"
          value={action.note}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              note: value,
            }))
          }
          className="min-h-24"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-signature`}>Signature</Label>
        <VariableTextarea
          id={`${actionId}-signature`}
          fieldLabel="Signature"
          value={action.signature}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              signature: value,
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
        <VariableInput
          id={`${actionId}-tone`}
          fieldLabel="Tone"
          value={action.draftTone}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              draftTone: value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-draft-instructions`}>
          Draft instructions
        </Label>
        <VariableTextarea
          id={`${actionId}-draft-instructions`}
          fieldLabel="Draft instructions"
          value={action.draftInstructions}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              draftInstructions: value,
            }))
          }
          className="min-h-28"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${actionId}-draft-signature`}>Signature</Label>
        <VariableTextarea
          id={`${actionId}-draft-signature`}
          fieldLabel="Signature"
          value={action.signature}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              signature: value,
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
        <VariableInput
          id={`${actionId}-archive-note`}
          fieldLabel="Archive note"
          value={action.note}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              note: value,
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
    return "Classification";
  }

  return "Action";
}

/** The one setting an action cannot run without, named on its marker. */
function actionNeeds(action: WorkflowAction) {
  if (action.type === "apply_label") {
    return "Needs a tag";
  }

  if (action.type === "forward") {
    return "Needs an address to forward to";
  }

  return "Needs draft instructions";
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
