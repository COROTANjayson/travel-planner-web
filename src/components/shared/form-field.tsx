import type { ComponentProps } from "react";
import { fieldRequired } from "@/components/shared/field-required";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormField({
  id,
  label,
  required,
  ...input
}: ComponentProps<typeof Input> & { id: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={required ? fieldRequired : undefined}>
        {label}
      </Label>
      <Input {...input} id={id} required={required} />
    </div>
  );
}
