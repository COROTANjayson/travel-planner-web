"use client";
import { Label } from "@/components/ui/label";
import { fieldRequired } from "@/components/shared/field-required";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
export function ExpenseSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  required,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id} className={required ? fieldRequired : undefined}>
        {label}
      </Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(value) => {
          if (value !== null) onChange(value);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>
            {options.find((option) => option.value === value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="min-h-11 whitespace-normal break-words"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
