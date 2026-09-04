"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InlineEditableTextProps = {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the field and the pencil button. */
  label: string;
  placeholder: string;
  /** Typography for both the read view and the field, so editing does not jump. */
  className?: string;
  /** Multi-line values edit in a textarea; Enter still commits. */
  multiline?: boolean;
  editButtonClassName?: string;
};

/**
 * Text that reads as plain copy until you click it — or its pencil — and then
 * edits in place. Enter or blur commits, Escape discards.
 */
export function InlineEditableText({
  value,
  onChange,
  label,
  placeholder,
  className,
  multiline = false,
  editButtonClassName,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [pendingValue, setPendingValue] = React.useState(value);

  function startEditing() {
    setPendingValue(value);
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
    onChange(pendingValue.trim());
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsEditing(false);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  if (isEditing) {
    const fieldProps = {
      autoFocus: true,
      "aria-label": label,
      value: pendingValue,
      placeholder,
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => setPendingValue(event.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
    };

    return multiline ? (
      <Textarea
        {...fieldProps}
        className={cn("min-h-16 w-full resize-none", className)}
      />
    ) : (
      <Input {...fieldProps} className={cn("h-auto w-full py-1", className)} />
    );
  }

  return (
    <div className="group/inline-edit flex min-w-0 items-start gap-1">
      <button
        type="button"
        onClick={startEditing}
        className={cn(
          "min-w-0 rounded-md border border-transparent px-1 py-1 text-left transition-colors hover:border-border hover:bg-muted/50",
          !value && "text-muted-foreground",
          className
        )}
      >
        {value || placeholder}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={startEditing}
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        className={cn(
          "size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/inline-edit:opacity-100 focus-visible:opacity-100",
          editButtonClassName
        )}
      >
        <Pencil className="size-3.5" />
      </Button>
    </div>
  );
}
