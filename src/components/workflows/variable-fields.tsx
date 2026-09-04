"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { insertAtSelection } from "@/lib/workflow-variables";

/**
 * A text field that can take a `{{variable}}`. The last one focused is where
 * the data panel inserts, which is why the target survives losing focus to the
 * panel's own buttons.
 */
type VariableTarget = {
  id: string;
  label: string;
  insert: (expression: string) => void;
};

type VariableInsertValue = {
  /** Label of the field an insert would land in, or null when there is none. */
  activeLabel: string | null;
  register: (target: VariableTarget) => void;
  release: (id: string) => void;
  insert: (expression: string) => void;
};

const VariableInsertContext = React.createContext<VariableInsertValue | null>(
  null
);

/**
 * Wraps a node's settings so the fields inside them can receive variables from
 * the data panel rendered alongside.
 */
export function VariableInsertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const targetRef = React.useRef<VariableTarget | null>(null);
  const [activeLabel, setActiveLabel] = React.useState<string | null>(null);

  const register = React.useCallback((target: VariableTarget) => {
    targetRef.current = target;
    setActiveLabel(target.label);
  }, []);

  const release = React.useCallback((id: string) => {
    if (targetRef.current?.id !== id) {
      return;
    }

    targetRef.current = null;
    setActiveLabel(null);
  }, []);

  const insert = React.useCallback((expression: string) => {
    targetRef.current?.insert(expression);
  }, []);

  const value = React.useMemo(
    () => ({ activeLabel, register, release, insert }),
    [activeLabel, insert, register, release]
  );

  return (
    <VariableInsertContext.Provider value={value}>
      {children}
    </VariableInsertContext.Provider>
  );
}

/** Read by the data panel so it knows where a picked value would go. */
export function useVariableInsert() {
  return React.useContext(VariableInsertContext);
}

/**
 * Tracks the caret in a controlled text field and registers the field as the
 * insert target while it has focus.
 */
function useVariableField<
  Element extends HTMLInputElement | HTMLTextAreaElement,
>({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const context = React.useContext(VariableInsertContext);
  const elementRef = React.useRef<Element | null>(null);
  const selectionRef = React.useRef({
    start: value.length,
    end: value.length,
  });
  // The insert callback stays stable so registering does not churn, so it
  // reads the value and handler of the last render rather than closing over
  // the ones it was created with.
  const latestRef = React.useRef({ value, onChange });
  const fieldId = React.useId();

  React.useEffect(() => {
    latestRef.current = { value, onChange };
  }, [onChange, value]);

  const rememberSelection = React.useCallback(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    selectionRef.current = {
      start: element.selectionStart ?? element.value.length,
      end: element.selectionEnd ?? element.value.length,
    };
  }, []);

  const insert = React.useCallback((expression: string) => {
    const current = latestRef.current;
    const next = insertAtSelection({
      value: current.value,
      expression,
      selectionStart: selectionRef.current.start,
      selectionEnd: selectionRef.current.end,
    });

    current.onChange(next.value);
    selectionRef.current = { start: next.caret, end: next.caret };

    // The field is controlled, so the caret can only be placed after React has
    // written the new value back into it.
    window.requestAnimationFrame(() => {
      const element = elementRef.current;

      if (!element) {
        return;
      }

      element.focus();
      element.setSelectionRange(next.caret, next.caret);
    });
  }, []);

  const release = context?.release;

  // A removed field must not stay the insert target — the panel would be
  // pointing at settings that are no longer on screen.
  React.useEffect(() => {
    if (!release) {
      return;
    }

    return () => release(fieldId);
  }, [fieldId, release]);

  return {
    ref: elementRef,
    onFocus: () => {
      rememberSelection();
      context?.register({ id: fieldId, label, insert });
    },
    onSelect: rememberSelection,
    onKeyUp: rememberSelection,
    onPointerUp: rememberSelection,
    rememberSelection,
  };
}

type VariableInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "ref"
> & {
  value: string;
  /** The field's own label, shown in the data panel as the insert target. */
  fieldLabel: string;
  onValueChange: (value: string) => void;
};

export function VariableInput({
  value,
  fieldLabel,
  onValueChange,
  ...props
}: VariableInputProps) {
  const { rememberSelection, ...fieldProps } =
    useVariableField<HTMLInputElement>({
      value,
      label: fieldLabel,
      onChange: onValueChange,
    });

  return (
    <Input
      {...props}
      {...fieldProps}
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
        rememberSelection();
      }}
    />
  );
}

type VariableTextareaProps = Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "onChange" | "ref"
> & {
  value: string;
  fieldLabel: string;
  onValueChange: (value: string) => void;
};

export function VariableTextarea({
  value,
  fieldLabel,
  onValueChange,
  ...props
}: VariableTextareaProps) {
  const { rememberSelection, ...fieldProps } =
    useVariableField<HTMLTextAreaElement>({
      value,
      label: fieldLabel,
      onChange: onValueChange,
    });

  return (
    <Textarea
      {...props}
      {...fieldProps}
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value);
        rememberSelection();
      }}
    />
  );
}
