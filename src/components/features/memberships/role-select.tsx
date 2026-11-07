"use client";

import type { AssignableRole } from "@/lib/memberships";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const roleHelp: Record<AssignableRole, string> = {
  editor: "Can change the trip, activities, prep tasks, and all expenses",
  member: "Can view plans, take prep tasks, and record expenses and payments",
  viewer: "Can view the trip but can't change anything",
};

export function RoleSelect({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label?: string;
  value: AssignableRole;
  disabled: boolean;
  onChange: (role: AssignableRole) => void;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(role) => {
        if (role === "editor" || role === "member" || role === "viewer")
          onChange(role);
      }}
    >
      <SelectTrigger id={id} aria-label={label} className="w-full sm:w-32">
        <SelectValue className="capitalize" />
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="w-88 max-w-(--available-width) p-1"
      >
        {(["editor", "member", "viewer"] as const).map((role) => (
          <SelectItem className="min-h-11 py-2" key={role} value={role}>
            <span className="flex flex-col whitespace-normal">
              <span className="font-medium capitalize">{role}</span>
              <span className="text-xs leading-5 text-muted-foreground">
                {roleHelp[role]}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
