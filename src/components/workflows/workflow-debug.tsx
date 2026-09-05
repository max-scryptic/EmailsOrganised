"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CircleSlash,
  Download,
  FlaskConical,
  Loader2,
  Mail,
  Paperclip,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  classifyDebugEmail,
  fetchDebugAttachment,
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
  emailVariableValues,
  formatBytes,
  sampleDebugEmail,
  type DebugAttachment,
  type DebugBranch,
  type DebugClassification,
  type DebugEmail,
  type DebugRun,
  type DebugSetting,
  type DebugValue,
} from "@/lib/workflow-debug";
import {
  usableClassificationLabels,
  type WorkflowDraft,
} from "@/lib/workflow-data";

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
  /** The email is in; the model is being asked which branch it takes. */
  | { phase: "classifying"; email: DebugEmail; source: DebugSource }
  | {
      phase: "running";
      email: DebugEmail;
      source: DebugSource;
      stepIndex: number;
      /** The model's answer, or null when it could not be asked. */
      classification: DebugClassification | null;
      classificationError: string | null;
      /** Set when the user chose a branch the model did not pick. */
      forcedLabelId: string | null;
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
            classification: session.classification,
            classificationError: session.classificationError,
            forcedLabelId: session.forcedLabelId,
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
  const isClassifying = session.phase === "classifying";
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
      phase: "classifying",
      email: sampleDebugEmail(),
      source: "sample",
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

  /** Follows a different output's branch, and steps into it straight away. */
  const chooseBranch = React.useCallback((labelId: string) => {
    setSession((current) =>
      current.phase === "running"
        ? { ...current, forcedLabelId: labelId, stepIndex: 2 }
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

  // The draft as it stands when the email lands. Read through a ref so the
  // classification is asked once per email rather than re-asked on every
  // keystroke while the run is on screen.
  const draftRef = React.useRef(draft);

  React.useEffect(() => {
    draftRef.current = draft;
  });

  const emailToClassify = session.phase === "classifying" ? session.email : null;
  const classifySource = session.phase === "classifying" ? session.source : null;

  // Ask the model which branch this email takes, then hand the answer to the
  // run. A failure is not fatal: the run still steps, and the classification
  // step invites the user to pick a branch instead.
  React.useEffect(() => {
    if (!emailToClassify || !classifySource) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const current = draftRef.current;
      const labels = usableClassificationLabels(current.labels).map((label) =>
        label.name.trim()
      );
      // Nothing to ask is not a failure — the classification is simply not
      // finished being built, and the run says so on its own step.
      const result =
        current.classifierPrompt.trim() && labels.length > 0
          ? await classifyDebugEmail({
              prompt: current.classifierPrompt,
              labels,
              email: emailVariableValues(emailToClassify),
            })
          : null;

      if (cancelled) {
        return;
      }

      setSession({
        phase: "running",
        email: emailToClassify,
        source: classifySource,
        stepIndex: 0,
        classification:
          result?.status === "classified" ? result.classification : null,
        classificationError:
          result?.status === "error" ? result.description : null,
        forcedLabelId: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [classifySource, emailToClassify]);

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
          phase: "classifying",
          email: result.email,
          source: "mailbox",
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
    isClassifying,
    isDebugging,
    isListening,
    /** The run is on the made-up email, so its files are described, not real. */
    isSample: session.phase === "running" && session.source === "sample",
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

        {step.branches ? (
          <BranchPicker
            branches={step.branches}
            error={run.classificationError}
            onChoose={debug.chooseBranch}
          />
        ) : null}

        {step.kind === "trigger" && run.email.attachments.length > 0 ? (
          <AttachmentList
            messageId={run.email.id}
            attachments={run.email.attachments}
            isSample={debug.isSample}
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
 * The files on the email, and the one place a test run reaches for their bytes.
 *
 * The trigger step describes attachments as metadata — that is all a variable
 * can carry — so this is where a user answers the question the metadata raises:
 * is this actually the invoice? Fetching pulls the file out of Gmail and hands
 * it over, which is a read, and the same call a live run makes when an action
 * takes the file with it.
 */
function AttachmentList({
  messageId,
  attachments,
  isSample,
}: {
  messageId: string;
  attachments: DebugAttachment[];
  isSample: boolean;
}) {
  return (
    <DebugSection title={`Attachments (${attachments.length})`}>
      {isSample ? (
        <p className="rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
          The sample email&rsquo;s files are described rather than real, so
          there is nothing to download. Listen for a real email to fetch one.
        </p>
      ) : null}
      {attachments.map((attachment) => (
        <AttachmentRow
          key={`${attachment.partId}-${attachment.filename}`}
          messageId={messageId}
          attachment={attachment}
          isSample={isSample}
        />
      ))}
    </DebugSection>
  );
}

type AttachmentFetch =
  | { status: "idle" }
  | { status: "fetching" }
  /** `url` is an object URL for the fetched bytes, revoked when it is replaced. */
  | { status: "ready"; url: string; size: number }
  | { status: "error"; description: string };

function AttachmentRow({
  messageId,
  attachment,
  isSample,
}: {
  messageId: string;
  attachment: DebugAttachment;
  isSample: boolean;
}) {
  const [fetchState, setFetchState] = React.useState<AttachmentFetch>({
    status: "idle",
  });

  // The object URL holds the bytes alive until it is released, so it is let go
  // as soon as this row stops pointing at it.
  React.useEffect(() => {
    if (fetchState.status !== "ready") {
      return;
    }

    const { url } = fetchState;

    return () => URL.revokeObjectURL(url);
  }, [fetchState]);

  const fetchBytes = React.useCallback(async () => {
    setFetchState({ status: "fetching" });

    const result = await fetchDebugAttachment({
      messageId,
      attachmentId: attachment.attachmentId,
      partId: attachment.partId,
    });

    if (result.status === "error") {
      setFetchState({ status: "error", description: result.description });
      return;
    }

    setFetchState({
      status: "ready",
      url: URL.createObjectURL(
        base64ToBlob(result.content, attachment.mimeType)
      ),
      size: result.size,
    });
  }, [attachment.attachmentId, attachment.mimeType, attachment.partId, messageId]);

  return (
    <div className="rounded-md border px-2 py-1.5">
      <div className="flex items-start gap-2">
        <Paperclip className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{attachment.filename}</p>
          <p className="truncate text-xs text-muted-foreground">
            {attachment.mimeType} · {formatBytes(attachment.size)}
            {attachment.inline ? " · inline" : null}
          </p>
        </div>
        {isSample ? null : fetchState.status === "ready" ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={fetchState.url} download={attachment.filename}>
              <Download className="size-3.5" />
              Save
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fetchState.status === "fetching"}
            onClick={() => void fetchBytes()}
          >
            {fetchState.status === "fetching" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {fetchState.status === "error" ? "Retry" : "Fetch"}
          </Button>
        )}
      </div>
      {fetchState.status === "ready" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Fetched {formatBytes(fetchState.size)} from Gmail.
        </p>
      ) : null}
      {fetchState.status === "error" ? (
        <p className="mt-1 text-xs text-destructive">
          {fetchState.description}
        </p>
      ) : null}
    </div>
  );
}

/** Base64 from the server action back into the bytes a download needs. */
function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

/**
 * Every output of the classification, with the one the model answered marked
 * and the one this run follows highlighted. Picking another steps the same
 * email down that branch, which is how a branch the email was never going to
 * reach gets tested at all.
 */
function BranchPicker({
  branches,
  error,
  onChoose,
}: {
  branches: DebugBranch[];
  /** Set when the model could not be asked at all. */
  error: string | null;
  onChoose: (labelId: string) => void;
}) {
  if (branches.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
        This classification has no outputs yet, so there is no branch to take.
      </p>
    );
  }

  return (
    <DebugSection title="Outputs">
      {error ? (
        <p className="rounded-md border border-dashed px-2 py-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {branches.map((branch) => (
        <button
          key={branch.labelId}
          type="button"
          onClick={() => onChoose(branch.labelId)}
          aria-pressed={branch.followed}
          className={cn(
            "w-full rounded-md border px-2 py-1.5 text-left transition",
            "hover:border-primary/60 hover:bg-primary/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            branch.followed && "border-primary/60 bg-primary/5"
          )}
        >
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs font-medium",
                branch.name || "italic text-muted-foreground"
              )}
            >
              {branch.name || "Unnamed output"}
            </span>
            {branch.picked ? (
              <Badge variant="outline" className="shrink-0">
                Model&rsquo;s answer
              </Badge>
            ) : null}
            {branch.followed && !branch.picked ? (
              <Badge variant="outline" className="shrink-0">
                Chosen
              </Badge>
            ) : null}
          </span>
          {branch.unusable ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {branch.unusable}
            </span>
          ) : null}
        </button>
      ))}
      <p className="text-xs text-muted-foreground">
        The branch is picked by the same model call this workflow runs on. Pick
        any output to step through its branch instead.
      </p>
    </DebugSection>
  );
}

/** The listening clock, as m:ss. */
function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);

  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
