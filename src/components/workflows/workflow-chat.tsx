"use client";

import * as React from "react";
import { ArrowRight, Loader2, PenLine, ShieldCheck, Send } from "lucide-react";
import { draftWorkflowFromChat } from "@/app/workflows/chat-actions";
import { ErrorState } from "@/components/states/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { actionLabels, type WorkflowDraft } from "@/lib/workflow-data";
import { isFilterActive } from "@/lib/workflow-filters";
import { generatedConfidenceThreshold } from "@/lib/workflow-intent";

/**
 * The conversation that turns "forward all sales emails to xyz@" into a
 * workflow.
 *
 * The chat is a drafting surface, not a replacement for the board: everything
 * it understands is shown as it goes, and the conversation ends by handing a
 * whole draft to the builder. The user never has to take the assistant's word
 * for what it built — they read it on the canvas and change it there.
 */

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatError = { title: string; description: string };

/**
 * The first thing the user sees, before they have typed anything. A constant
 * rather than a generated turn, so the page opens with something to read
 * instead of a spinner and a round trip.
 */
const greeting =
  "Tell me what you would like to happen to your email. Something like " +
  "“forward all sales enquiries to sales@mycompany.com” is plenty to start " +
  "with — I will ask about the details.";

export function WorkflowChat({
  onOpenEditor,
  onReturnToEditor,
}: {
  /** Called with the drafted workflow, or null to start from a blank board. */
  onOpenEditor: (draft: WorkflowDraft | null) => void;
  /**
   * Set once a board exists, and goes back to it without touching it. Its
   * absence is what tells the chat it is still the first phase, where the only
   * way to the builder is to open one.
   */
  onReturnToEditor?: () => void;
}) {
  const messageId = React.useRef(0);
  const nextId = React.useCallback(() => {
    messageId.current += 1;

    return `message-${messageId.current}`;
  }, []);

  const [messages, setMessages] = React.useState<ChatMessage[]>(() => [
    { id: "greeting", role: "assistant", content: greeting },
  ]);
  const [input, setInput] = React.useState("");
  const [draft, setDraft] = React.useState<WorkflowDraft | null>(null);
  const [canOpen, setCanOpen] = React.useState(false);
  const [error, setError] = React.useState<ChatError | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const transcriptRef = React.useRef<HTMLDivElement>(null);

  // A new turn is only useful if it is on screen, and the pending indicator
  // sits below the last message — so this follows the thinking state too.
  React.useEffect(() => {
    const transcript = transcriptRef.current;

    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [messages, isPending]);

  const send = React.useCallback(
    (history: ChatMessage[]) => {
      setError(null);

      startTransition(async () => {
        const result = await draftWorkflowFromChat({
          messages: history.map(({ role, content }) => ({ role, content })),
        });

        if (result.status === "error") {
          setError({ title: result.title, description: result.description });

          return;
        }

        setMessages((current) => [
          ...current,
          { id: nextId(), role: "assistant", content: result.reply },
        ]);
        // A turn that understood less than the one before it still replaces the
        // preview: the latest reading of the conversation is the only one that
        // matches what the user was just told.
        setDraft(result.draft);
        setCanOpen(result.canOpen);
      });
    },
    [nextId]
  );

  const submit = React.useCallback(() => {
    const content = input.trim();

    if (!content || isPending) {
      return;
    }

    const history: ChatMessage[] = [
      ...messages,
      { id: nextId(), role: "user", content },
    ];

    setMessages(history);
    setInput("");
    send(history);
  }, [input, isPending, messages, nextId, send]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">
            New workflow
          </h1>
          <p className="text-sm text-muted-foreground">
            Describe what you want done with your email. I will build the
            workflow and you can check it on the board before saving.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Before there is a board, the second way out of the chat is to
              skip it and start from a blank one. Once there is, that offer is
              gone — the board is the work, and the button that sits here goes
              back to it. */}
          {onReturnToEditor ? (
            <Button type="button" variant="outline" onClick={onReturnToEditor}>
              <PenLine className="size-4" />
              Back to the editor
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenEditor(null)}
            >
              <PenLine className="size-4" />
              Build it myself
            </Button>
          )}
          <Button
            type="button"
            // Outline until there is something to open. A disabled primary
            // still reads as orange, and an accent on a button that cannot be
            // pressed spends the one colour the page has on a dead end.
            variant={canOpen ? "default" : "outline"}
            disabled={!canOpen || !draft}
            onClick={() => onOpenEditor(draft)}
          >
            {/* Naming the effect, because this is the one button that throws
                away whatever is on the board and puts the conversation's
                latest reading there instead. */}
            {onReturnToEditor ? "Update the board" : "Open in the editor"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
        <Card className="flex min-h-96 flex-col gap-0 overflow-hidden py-0">
          <div
            ref={transcriptRef}
            className="min-h-0 flex-1 overflow-y-auto p-4"
          >
            {/* `min-h-full` with `justify-end` sits a short conversation on
                the composer rather than stranding it at the top of an empty
                column, and still scrolls from the top once it outgrows the
                card. */}
            <div className="flex min-h-full flex-col justify-end gap-4">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {isPending ? <Thinking /> : null}
            </div>
          </div>

          {error ? (
            <div className="px-4 pb-3">
              <ErrorState
                title={error.title}
                description={error.description}
                onRetry={() => send(messages)}
              />
            </div>
          ) : null}

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  // Enter sends, because this is a conversation and not a form.
                  // Shift+Enter is still there for anyone pasting an example
                  // email across several lines.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder="Forward every sales enquiry to sales@mycompany.com"
                aria-label="Describe your workflow"
                rows={2}
                className="max-h-40 min-h-16 resize-none"
              />
              <Button
                type="button"
                // The accent belongs to whichever step is next. Until there is
                // a workflow to open, that is sending the next message; once
                // there is, the accent moves to "Open in the editor" and this
                // steps back to an outline.
                variant={canOpen ? "outline" : "default"}
                size="icon"
                disabled={!input.trim() || isPending}
                onClick={submit}
                aria-label="Send message"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-medium">What this will do</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {draft ? (
              <DraftPreview draft={draft} />
            ) : (
              <p className="text-sm text-muted-foreground">
                As you describe what you want, the workflow will take shape
                here.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] text-sm whitespace-pre-wrap",
          // The user's own words get a quiet fill so the transcript reads as a
          // back-and-forth. Neither side is accented — the orange is spent on
          // the step the page wants next, not on decorating speech.
          isUser
            ? "rounded-lg bg-muted px-3 py-2"
            : "text-foreground [&:not(:first-child)]:pt-0"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Working out what that means…
    </div>
  );
}

/**
 * The workflow as it currently stands, in the same vocabulary the board uses.
 *
 * This is not a second builder — nothing here is editable. It exists so the
 * user can see the shape being assembled while they talk, and so "Open in the
 * editor" is never a surprise.
 */
function DraftPreview({ draft }: { draft: WorkflowDraft }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      {draft.name ? (
        <div>
          <PreviewLabel>Workflow</PreviewLabel>
          <p className="font-medium">{draft.name}</p>
        </div>
      ) : null}

      <div>
        <PreviewLabel>Trigger</PreviewLabel>
        <p className="text-muted-foreground">{draft.trigger}</p>
      </div>

      {draft.classifierPrompt ? (
        <div>
          <PreviewLabel>How each email is sorted</PreviewLabel>
          <p className="text-muted-foreground">{draft.classifierPrompt}</p>
        </div>
      ) : null}

      {draft.labels.length > 0 ? (
        <div className="flex flex-col gap-3">
          <PreviewLabel>Branches</PreviewLabel>
          {draft.labels.map((label) => (
            <div
              key={label.id}
              className="flex flex-col gap-1.5 border-l pl-3"
            >
              <Badge variant="outline" className="w-fit">
                {label.name || "Unnamed"}
              </Badge>
              {label.actions.length === 0 ? (
                <p className="text-muted-foreground">
                  Nothing happens — the email is left alone.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {label.actions.map((action) => (
                    <li key={action.id} className="flex flex-col gap-1">
                      {isFilterActive(action.filter) ? (
                        <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                          Only when the sort is at least{" "}
                          {Math.round(generatedConfidenceThreshold * 100)}% sure
                        </span>
                      ) : null}
                      <span>
                        {actionLabels[action.type]}
                        {action.forwardTo ? (
                          <span className="text-muted-foreground">
                            {" "}
                            to {action.forwardTo}
                          </span>
                        ) : null}
                        {action.type === "apply_label" && action.labelName ? (
                          <span className="text-muted-foreground">
                            {" "}
                            as {action.labelName}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-xs font-medium text-muted-foreground">{children}</p>
  );
}
