"use client";

import * as React from "react";
import { MessageSquare, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  chatMessageMaxLength,
  createExampleEmail,
  describeExampleEmails,
  exampleBodyMaxLength,
  exampleSubjectMaxLength,
  type ExampleEmail,
} from "@/lib/workflow-chat-examples";

/**
 * The composer the chat swaps in when it asks for example emails.
 *
 * An example is a real message, so it is collected as one: a subject and a
 * body, with a button to add the next. Typing "an example is: Subject: …" into
 * a chat box works, but it asks the person to invent a format and asks the
 * model to guess where one example stopped and the next began — the form ends
 * both guesses, and `describeExampleEmails` is the single rendering everyone
 * downstream reads.
 *
 * Counter-examples sit behind a button. Most people describe what they want
 * caught and are done; being asked, every time, for mail that only *looks*
 * like it is a question about a distinction they may not have. The button is
 * there for when they do have one.
 */
export function ExampleEmailComposer({
  onSend,
  onWriteInstead,
  disabled,
  accented,
}: {
  /** Called with the examples written out as one message in the user's voice. */
  onSend: (message: string) => void;
  /** Goes back to the plain message box without sending anything. */
  onWriteInstead: () => void;
  disabled: boolean;
  /**
   * Whether sending these examples is the page's next step. It is not once
   * there is a workflow to open — the accent belongs to that button instead,
   * and this one steps back to an outline.
   */
  accented: boolean;
}) {
  const exampleId = React.useRef(0);
  const nextExample = React.useCallback(() => {
    exampleId.current += 1;

    return createExampleEmail(`example-${exampleId.current}`);
  }, []);

  const [examples, setExamples] = React.useState<ExampleEmail[]>(() => [
    createExampleEmail("example-0"),
  ]);
  // An empty list is the closed state: counter-examples exist only once the
  // person has asked for them.
  const [counterExamples, setCounterExamples] = React.useState<ExampleEmail[]>(
    []
  );

  const message = React.useMemo(
    () => describeExampleEmails({ examples, counterExamples }),
    [counterExamples, examples]
  );

  const tooLong = message.length > chatMessageMaxLength;
  const canSend = message.length > 0 && !tooLong && !disabled;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Example emails
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onWriteInstead}
          disabled={disabled}
        >
          <MessageSquare />
          Write a message instead
        </Button>
      </div>

      {/* The card's transcript is already the scrolling half of this view, so
          the composer takes a ceiling of its own rather than pushing the
          conversation off the top as examples are added. */}
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        <ExampleGroup
          examples={examples}
          label="Example"
          addLabel="Add another example"
          subjectPlaceholder="Quote for 500 units"
          disabled={disabled}
          // The list of wanted examples is the point of the form, so it always
          // keeps one row.
          keepLast
          onChange={setExamples}
          onAdd={() => setExamples((current) => [...current, nextExample()])}
        />

        {counterExamples.length > 0 ? (
          <div className="flex flex-col gap-2 border-t pt-3">
            <div>
              <p className="text-xs font-medium">Emails to leave alone</p>
              <p className="text-xs text-muted-foreground">
                Mail that looks similar but should not be caught.
              </p>
            </div>
            <ExampleGroup
              examples={counterExamples}
              label="Counter-example"
              addLabel="Add another counter-example"
              subjectPlaceholder="Your weekly supplier newsletter"
              disabled={disabled}
              onChange={setCounterExamples}
              onAdd={() =>
                setCounterExamples((current) => [...current, nextExample()])
              }
            />
          </div>
        ) : null}
      </div>

      {tooLong ? (
        <p className="text-xs text-destructive">
          That is more text than one message can carry. Shorten the bodies —
          the first few lines of an email are usually enough to tell it apart.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {counterExamples.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mr-auto"
            disabled={disabled}
            onClick={() => setCounterExamples([nextExample()])}
          >
            <Plus />
            Add counter-examples
          </Button>
        ) : null}
        <Button
          type="button"
          variant={accented ? "default" : "outline"}
          size="sm"
          disabled={!canSend}
          onClick={() => onSend(message)}
        >
          Send examples
          <Send />
        </Button>
      </div>
    </div>
  );
}

/**
 * One list of examples and the button that grows it. Both lists are the same
 * thing said about different mail, so they are the same component — only the
 * words on the rows change.
 */
function ExampleGroup({
  examples,
  label,
  addLabel,
  subjectPlaceholder,
  disabled,
  keepLast = false,
  onChange,
  onAdd,
}: {
  examples: ExampleEmail[];
  label: string;
  addLabel: string;
  subjectPlaceholder: string;
  disabled: boolean;
  /**
   * Stops the group being emptied. Set on the wanted examples, whose heading
   * would otherwise stand over nothing; the counter-example group leaves it off
   * because an empty list is how that section closes again.
   */
  keepLast?: boolean;
  onChange: React.Dispatch<React.SetStateAction<ExampleEmail[]>>;
  onAdd: () => void;
}) {
  const update = (id: string, patch: Partial<ExampleEmail>) => {
    onChange((current) =>
      current.map((example) =>
        example.id === id ? { ...example, ...patch } : example
      )
    );
  };

  const remove = (id: string) => {
    onChange((current) => current.filter((example) => example.id !== id));
  };

  return (
    <div className="flex flex-col gap-2">
      {examples.map((example, index) => (
        <ExampleFields
          key={example.id}
          example={example}
          removable={!keepLast || examples.length > 1}
          title={`${label} ${index + 1}`}
          subjectPlaceholder={subjectPlaceholder}
          disabled={disabled}
          onChange={(patch) => update(example.id, patch)}
          onRemove={() => remove(example.id)}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={disabled}
        onClick={onAdd}
      >
        <Plus />
        {addLabel}
      </Button>
    </div>
  );
}

function ExampleFields({
  example,
  title,
  subjectPlaceholder,
  removable,
  disabled,
  onChange,
  onRemove,
}: {
  example: ExampleEmail;
  title: string;
  subjectPlaceholder: string;
  removable: boolean;
  disabled: boolean;
  onChange: (patch: Partial<ExampleEmail>) => void;
  onRemove: () => void;
}) {
  const subjectId = `${example.id}-subject`;
  const bodyId = `${example.id}-body`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {removable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled}
            onClick={onRemove}
            aria-label={`Remove ${title.toLowerCase()}`}
          >
            <X />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={subjectId} className="text-xs text-muted-foreground">
          Subject
        </Label>
        <Input
          id={subjectId}
          value={example.subject}
          maxLength={exampleSubjectMaxLength}
          disabled={disabled}
          placeholder={subjectPlaceholder}
          onChange={(event) => onChange({ subject: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={bodyId} className="text-xs text-muted-foreground">
          Body
        </Label>
        <Textarea
          id={bodyId}
          value={example.body}
          maxLength={exampleBodyMaxLength}
          disabled={disabled}
          rows={3}
          placeholder="Paste the email, or the first few lines of it."
          className="max-h-40 min-h-16"
          onChange={(event) => onChange({ body: event.target.value })}
        />
      </div>
    </div>
  );
}
