"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CircleSlash,
  FlaskConical,
  Loader2,
  Mail,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  pollDebugWatch,
  startDebugWatch,
  type DebugWatchError,
} from "@/app/workflows/debug-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  buildDebugRun,
  sampleDebugEmail,
  type DebugEmail,
  type DebugRun,
  type DebugSetting,
  type DebugValue,
  type OutcomeScore,
} from "@/lib/workflow-debug";
import type { WorkflowDraft } from "@/lib/workflow-data";

/** How often the watcher asks Gmail whether anything has landed. */
const pollIntervalMs = 4000;
/** The first poll waits less, so an email already on its way arrives quickly. */
const firstPollDelayMs = 1200;

type DebugSource = "mailbox" | "sample";

/**
 * Where a test is up to. Listening and running are deliberately separate: while
 * the board is listening the trigger node wears the live state and nothing else
 * has happened yet; once an email arrives the run takes over the board.
 */
export type DebugSession =
  | { phase: "off" }
  | { phase: "starting" }
  | { phase: "listening"; startedAt: number; mailbox: string }
  | { phase: "error"; error: DebugWatchError }
  | {
      phase: "running";
      email: DebugEmail;
      source: DebugSource;
      stepIndex: number;
      /** Set when the user chose a branch the word match did not pick. */
      forcedOutcomeId: string | null;
    };

export type WorkflowDebug = ReturnType<typeof useWorkflowDebug>;

/**
 * Owns a test from the button press to the last step: listening to the mailbox,
 * building the run when an email arrives, and walking it node by node.
 *
 * The run is derived from the draft on the board rather than from anything
 * saved, so a workflow can be tested before it has ever been saved.
 */
export function useWorkflowDebug(draft: WorkflowDraft) {
  const [session, setSession] = React.useState<DebugSession>({ phase: "off" });
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  // Messages this session has already run, so waiting for another email never
  // replays the one just stepped through.
  const handledIds = React.useRef<string[]>([]);

  const run = React.useMemo<DebugRun | null>(
    () =>
      session.phase === "running"
        ? buildDebugRun({
            draft,
            email: session.email,
            forcedOutcomeId: session.forcedOutcomeId,
          })
        : null,
    [draft, session]
  );
  const stepCount = run?.steps.length ?? 0;
  // Editing the branch mid-run can shorten the run under the cursor.
  const stepIndex =
    session.phase === "running"
      ? Math.min(session.stepIndex, Math.max(stepCount - 1, 0))
      : 0;
  const step = run?.steps[stepIndex] ?? null;
  const isRunning = session.phase === "running";
  const isDebugging = session.phase !== "off";
  /** True from pressing Test until an email arrives — the watcher is armed. */
  const isListening =
    session.phase === "starting" || session.phase === "listening";
  const listeningSince =
    session.phase === "listening" ? session.startedAt : null;

  const startListening = React.useCallback(async () => {
    setSession({ phase: "starting" });
    setElapsedSeconds(0);

    const result = await startDebugWatch();

    setSession(
      result.status === "listening"
        ? {
            phase: "listening",
            startedAt: result.startedAt,
            mailbox: result.mailbox,
          }
        : { phase: "error", error: result }
    );
  }, []);

  const start = React.useCallback(() => {
    void startListening();
  }, [startListening]);

  const stop = React.useCallback(() => {
    setSession({ phase: "off" });
  }, []);

  const useSample = React.useCallback(() => {
    setSession({
      phase: "running",
      email: sampleDebugEmail(),
      source: "sample",
      stepIndex: 0,
      forcedOutcomeId: null,
    });
  }, []);

  const goToStep = React.useCallback((index: number) => {
    setSession((current) =>
      current.phase === "running"
        ? { ...current, stepIndex: Math.max(index, 0) }
        : current
    );
  }, []);

  const next = React.useCallback(() => {
    setSession((current) =>
      current.phase === "running"
        ? {
            ...current,
            stepIndex: Math.min(current.stepIndex + 1, stepCount - 1),
          }
        : current
    );
  }, [stepCount]);

  const back = React.useCallback(() => {
    setSession((current) =>
      current.phase === "running"
        ? { ...current, stepIndex: Math.max(current.stepIndex - 1, 0) }
        : current
    );
  }, []);

  const restart = React.useCallback(() => {
    setSession((current) =>
      current.phase === "running" ? { ...current, stepIndex: 0 } : current
    );
  }, []);

  /** Follows a different classification, and steps into it straight away. */
  const chooseBranch = React.useCallback((outcomeId: string) => {
    setSession((current) =>
      current.phase === "running"
        ? { ...current, forcedOutcomeId: outcomeId, stepIndex: 2 }
        : current
    );
  }, []);

  /** Jumps to the step for a node, for clicking a node on the board. */
  const goToNode = React.useCallback(
    (nodeId: string) => {
      const index = run?.steps.findIndex((item) => item.nodeId === nodeId) ?? -1;

      if (index >= 0) {
        goToStep(index);
      }
    },
    [goToStep, run]
  );

  // Poll the mailbox while listening. One timer at a time, chained rather than
  // on an interval, so a slow answer cannot stack requests.
  React.useEffect(() => {
    if (listeningSince === null) {
      return;
    }

    let cancelled = false;
    let timer = 0;

    async function tick() {
      const result = await pollDebugWatch({
        startedAt: listeningSince as number,
        seenIds: handledIds.current,
      });

      if (cancelled) {
        return;
      }

      if (result.status === "received") {
        handledIds.current = [result.email.id, ...handledIds.current].slice(
          0,
          20
        );
        setSession({
          phase: "running",
          email: result.email,
          source: "mailbox",
          stepIndex: 0,
          forcedOutcomeId: null,
        });
        return;
      }

      if (result.status === "error") {
        setSession({ phase: "error", error: result });
        return;
      }

      timer = window.setTimeout(() => void tick(), pollIntervalMs);
    }

    timer = window.setTimeout(() => void tick(), firstPollDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [listeningSince]);

  // How long the watcher has been waiting, so the bar is visibly alive.
  React.useEffect(() => {
    if (listeningSince === null) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - listeningSince) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [listeningSince]);

  // Arrow keys walk the run, the way they walk a slideshow.
  React.useEffect(() => {
    if (!isRunning) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back, isRunning, next]);

  return {
    session,
    run,
    step,
    stepIndex,
    stepCount,
    isRunning,
    isDebugging,
    isListening,
    elapsedSeconds,
    /** Node ids the run passes through, for dimming everything it does not. */
    activeNodeIds: React.useMemo(
      () => new Set(run?.steps.map((item) => item.nodeId) ?? []),
      [run]
    ),
    start,
    stop,
    useSample,
    next,
    back,
    restart,
    goToStep,
    goToNode,
    chooseBranch,
  };
}

/**
 * The one modal in debug mode, and only for the states that are a decision:
 * the mailbox cannot be watched, so the user reconnects, retries, or falls back
 * to the sample email. Listening itself is not modal — it happens on the board,
 * on the node that is doing the listening.
 */
export function WorkflowDebugDialog({ debug }: { debug: WorkflowDebug }) {
  const { session } = debug;
  const error = session.phase === "error" ? session.error : null;

  return (
    <Dialog
      open={Boolean(error)}
      onOpenChange={(next) => {
        if (!next) {
          debug.stop();
        }
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" />
            {error?.title}
          </DialogTitle>
          <DialogDescription>{error?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={debug.stop}>
            Close
          </Button>
          {error?.problem === "disconnected" ? (
            <Button type="button" variant="outline" asChild>
              <Link href="/auth/sign-in">Reconnect mailbox</Link>
            </Button>
          ) : error?.problem === "failed" ? (
            <Button type="button" variant="outline" onClick={debug.start}>
              <RotateCcw className="size-4" />
              Try again
            </Button>
          ) : null}
          <Button type="button" onClick={debug.useSample}>
            <Mail className="size-4" />
            Use a sample email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The test's controls, floating in the corner of the board opposite the zoom
 * toolbar. It carries both halves of a test: waiting for an email, then where
 * the run is up to and the way out.
 */
export function WorkflowDebugBar({ debug }: { debug: WorkflowDebug }) {
  const { run, session, step, stepIndex, stepCount } = debug;

  if (session.phase === "off" || session.phase === "error") {
    return null;
  }

  if (session.phase !== "running" || !run) {
    return (
      <DebugBarShell>
        <DebugListeningBar
          debug={debug}
          mailbox={session.phase === "listening" ? session.mailbox : null}
        />
      </DebugBarShell>
    );
  }

  const atEnd = stepIndex >= stepCount - 1;

  return (
    <DebugBarShell>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="shrink-0 gap-1">
          <FlaskConical className="size-3" />
          Test run
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {run.email.subject || "(no subject)"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {session.source === "sample"
              ? "Sample email"
              : `From ${run.email.fromName || run.email.fromAddress}`}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={debug.stop}
          aria-label="Exit test mode"
          title="Exit test mode"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={debug.back}
          disabled={stepIndex === 0}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        <span className="min-w-20 flex-1 text-center text-xs tabular-nums text-muted-foreground">
          Step {stepIndex + 1} of {stepCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={debug.next}
          disabled={atEnd}
        >
          Next
          <ArrowRight className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={debug.restart}
          aria-label="Back to the first step"
          title="Back to the first step"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
      {atEnd && run.endNote ? (
        <p className="text-xs text-muted-foreground">{run.endNote}</p>
      ) : null}
      {atEnd ? (
        // The end of one run is where you want the next email, not the end of
        // testing — so listening again is one click, not Exit and Test again.
        <Button type="button" variant="outline" size="sm" onClick={debug.start}>
          <Mail className="size-3.5" />
          Listen for another email
        </Button>
      ) : null}
      {step?.kind === "action" ? (
        <p className="text-xs text-muted-foreground">
          Actions are simulated. Nothing is sent, tagged, or archived.
        </p>
      ) : null}
    </DebugBarShell>
  );
}

/** The floating strip both halves of a test live in. */
function DebugBarShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-canvas-overlay
      className="absolute left-3 top-3 z-30 flex w-80 max-w-[calc(100%-1.5rem)] flex-col gap-2 rounded-lg border bg-card p-2 shadow-lg"
    >
      {children}
    </div>
  );
}

/**
 * Waiting for mail. The board keeps the detail — the trigger node is wearing
 * the live state — so this stays the status line and the way out of it.
 */
function DebugListeningBar({
  debug,
  mailbox,
}: {
  debug: WorkflowDebug;
  mailbox: string | null;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="shrink-0 gap-1">
          <FlaskConical className="size-3" />
          Test run
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {mailbox ? "Listening for an email" : "Connecting to your mailbox"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {mailbox ?? "Checking that mailbox access still works"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={debug.stop}
          aria-label="Stop listening"
          title="Stop listening"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {mailbox
            ? "Send yourself an email. The first one to arrive starts the run — anything already in the inbox is ignored."
            : "One moment."}
        </p>
        {mailbox ? (
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {formatElapsed(debug.elapsedSeconds)}
          </span>
        ) : null}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={debug.useSample}>
        <Mail className="size-3.5" />
        Use a sample email instead
      </Button>
    </>
  );
}

/**
 * What the current node did with this email, floating beside that node the same
 * way the settings inspector does — so the run is read on the board, at the
 * node it is talking about.
 */
export function WorkflowDebugStepPanel({
  ref,
  debug,
  position,
  width,
  maxHeight,
}: {
  ref: React.Ref<HTMLDivElement>;
  debug: WorkflowDebug;
  /** Board-relative pixels, already flipped and clamped to stay on screen. */
  position: { x: number; y: number };
  width: number;
  maxHeight: number;
}) {
  const { run, step, stepIndex, stepCount } = debug;

  if (!run || !step) {
    return null;
  }

  return (
    <div
      ref={ref}
      role="dialog"
      data-canvas-overlay
      aria-label={`${step.kindLabel} step: ${step.title}`}
      className="absolute left-0 top-0 z-40 flex max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border bg-card shadow-xl duration-150 animate-in fade-in-0 zoom-in-95"
      style={{
        width,
        maxHeight,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className="shrink-0">
            {step.kindLabel}
          </Badge>
          <span className="truncate text-sm font-medium">{step.title}</span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {stepIndex + 1}/{stepCount}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="flex items-start gap-2">
          {step.simulated ? (
            <CircleSlash className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
          )}
          <p className="text-sm">{step.summary}</p>
        </div>

        {step.simulated ? (
          <p className="rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
            Simulated. Your mailbox is not touched by a test run.
          </p>
        ) : null}

        {step.scores ? (
          <BranchPicker
            scores={step.scores}
            matchedOutcomeId={run.matchedOutcomeId}
            forced={run.forced}
            onChoose={debug.chooseBranch}
          />
        ) : null}

        {step.settings.length > 0 ? (
          <DebugSection title="Settings, as this step read them">
            {step.settings.map((setting) => (
              <SettingRow key={setting.label} setting={setting} />
            ))}
          </DebugSection>
        ) : null}

        {step.outputs.length > 0 ? (
          <DebugSection title="What this step produced">
            {step.outputs.map((output) => (
              <OutputRow key={output.token} output={output} />
            ))}
          </DebugSection>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={debug.back}
          disabled={stepIndex === 0}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={debug.next}
          disabled={stepIndex >= stepCount - 1}
        >
          Next step
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DebugSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

/**
 * One setting, shown as what was typed and what it became. The template line
 * only appears when it differs — a field with no variables in it is already
 * saying everything it has to say.
 */
function SettingRow({ setting }: { setting: DebugSetting }) {
  const changed = setting.template !== setting.value;

  return (
    <div className="rounded-md border bg-muted/40 px-2 py-1.5">
      <p className="text-xs font-medium">{setting.label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs">
        {setting.value || (
          <span className="text-muted-foreground">Not set</span>
        )}
      </p>
      {changed ? (
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
          from {setting.template}
        </p>
      ) : null}
      {setting.missing.length > 0 ? (
        <p className="mt-1 text-xs text-destructive">
          {setting.missing.map((token) => `{{${token}}}`).join(", ")} had no
          value at this point in the run.
        </p>
      ) : null}
    </div>
  );
}

function OutputRow({ output }: { output: DebugValue }) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <p className="truncate text-xs font-medium">{output.label}</p>
      {/* Same shape as the variable panel's rows: name, the token you would
          type, then what it holds. */}
      <code className="mt-1 block w-fit max-w-full truncate rounded-sm bg-primary/10 px-1 font-mono text-xs">
        {`{{${output.token}}}`}
      </code>
      <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs">
        {output.pending ? (
          <span className="text-muted-foreground">
            Only produced on a live run
          </span>
        ) : (
          output.value || <span className="text-muted-foreground">Empty</span>
        )}
      </p>
    </div>
  );
}

/**
 * Every classification and how it scored, with the branch the run is following
 * marked. Picking another one re-runs the same email down that branch, which is
 * how a classification with no matching words is tested at all.
 */
function BranchPicker({
  scores,
  matchedOutcomeId,
  forced,
  onChoose,
}: {
  scores: OutcomeScore[];
  matchedOutcomeId: string | null;
  forced: boolean;
  onChoose: (outcomeId: string) => void;
}) {
  if (scores.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
        There is nothing to score yet.
      </p>
    );
  }

  return (
    <DebugSection title="How each classification scored">
      {scores.map((score) => {
        const isFollowed = score.outcomeId === matchedOutcomeId;

        return (
          <button
            key={score.outcomeId}
            type="button"
            onClick={() => onChoose(score.outcomeId)}
            aria-pressed={isFollowed}
            className={cn(
              "w-full rounded-md border px-2 py-1.5 text-left transition",
              "hover:border-primary/60 hover:bg-primary/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isFollowed && "border-primary/60 bg-primary/5"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {score.name || "Untitled classification"}
              </span>
              {isFollowed ? (
                <Badge variant="outline" className="shrink-0">
                  {forced ? "Chosen" : "Followed"}
                </Badge>
              ) : null}
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {score.score.toFixed(2)}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {score.reason}
            </span>
          </button>
        );
      })}
      <p className="text-xs text-muted-foreground">
        In a test run the branch is picked by matching each classification&rsquo;s
        own words against the email, not by the model that runs it live. Pick any
        classification to step through its branch.
      </p>
    </DebugSection>
  );
}

/** The listening clock, as m:ss. */
function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);

  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
