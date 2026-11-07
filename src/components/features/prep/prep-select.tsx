"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { participantName, type Participant } from "@/lib/memberships";

export type PrepOption = { value: string; label: string };

/** "0" means nobody is assigned, so anyone taking part can claim the task. */
export const assigneeOptions = (people: Participant[]): PrepOption[] => [
  { value: "0", label: "Anyone can claim it" },
  ...people.map((person) => ({
    value: String(person.user_id),
    label: participantName(person),
  })),
];

export function PrepSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: PrepOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>
            {options.find((option) => option.value === value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className="max-w-(--available-width)"
        >
          {options.map((option) => (
            <SelectItem
              className="min-h-11"
              key={option.value}
              value={option.value}
            >
              <span className="whitespace-normal break-words">
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
