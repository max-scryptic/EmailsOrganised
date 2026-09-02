import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TemplateFormFieldProps = {
  label: string;
  error?: FieldError;
  registration: UseFormRegisterReturn;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  textarea?: boolean;
  className?: string;
};

export function TemplateFormField({
  label,
  error,
  registration,
  type = "text",
  placeholder,
  textarea,
  className,
}: TemplateFormFieldProps) {
  const id = registration.name;
  const describedBy = error ? `${id}-error` : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {textarea ? (
        <Textarea
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          placeholder={placeholder}
          {...registration}
        />
      ) : (
        <Input
          id={id}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          placeholder={placeholder}
          {...registration}
        />
      )}
      {error ? (
        <p id={describedBy} className="text-xs text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
