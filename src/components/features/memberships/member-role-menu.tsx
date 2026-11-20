"use client";

import { Menu } from "@base-ui/react/menu";
import {
  CheckIcon,
  CaretDownIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react";
import { roleHelp } from "@/components/features/memberships/role-select";
import { Button } from "@/components/ui/button";
import type { AssignableRole } from "@/lib/memberships";

const roles = ["editor", "member", "viewer"] as const;
const itemClass =
  "flex cursor-default gap-2.5 rounded-[10px] px-2.5 outline-none data-highlighted:bg-accent";

export function MemberRoleMenu({
  name,
  role,
  disabled,
  onChange,
  onTransfer,
  onRemove,
}: {
  name: string;
  role: AssignableRole;
  disabled: boolean;
  onChange: (role: AssignableRole) => void;
  onTransfer: () => void;
  onRemove: () => void;
}) {
  return (
    <Menu.Root disabled={disabled} modal={false}>
      <Menu.Trigger
        aria-label={`Role for ${name}: ${role}`}
        render={
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 shrink-0 gap-1 py-0 pr-2 pl-3 capitalize aria-expanded:border-primary md:min-h-9"
          />
        }
      >
        {role}
        <CaretDownIcon aria-hidden="true" className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} className="z-50">
          <Menu.Popup className="max-h-(--available-height) w-[300px] max-w-[min(var(--available-width),calc(100vw-1rem))] overflow-y-auto rounded-[14px] border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none">
            <Menu.Group>
              <Menu.GroupLabel className="px-2.5 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground">
                Change role
              </Menu.GroupLabel>
              <Menu.RadioGroup
                value={role}
                onValueChange={(next) => {
                  const selected = roles.find((option) => option === next);
                  if (selected && selected !== role) onChange(selected);
                }}
              >
                {roles.map((option) => (
                  <Menu.RadioItem
                    key={option}
                    value={option}
                    label={option}
                    closeOnClick
                    className={`${itemClass} items-start py-2 data-checked:bg-accent`}
                  >
                    <span className="mt-1 size-4 shrink-0 text-primary">
                      <Menu.RadioItemIndicator>
                        <CheckIcon aria-hidden="true" className="size-4" />
                      </Menu.RadioItemIndicator>
                    </span>
                    <span className="grid gap-0.5">
                      <span className="font-medium capitalize">{option}</span>
                      <span className="text-[0.8125rem] leading-5 text-muted-foreground">
                        {roleHelp[option]}
                      </span>
                    </span>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
            <Menu.Separator className="my-1 border-t" />
            <Menu.Item
              className={`${itemClass} min-h-11 items-center`}
              onClick={onTransfer}
            >
              <UserIcon aria-hidden="true" className="size-4 shrink-0" />
              Transfer ownership
            </Menu.Item>
            <Menu.Item
              className={`${itemClass} min-h-11 items-center text-destructive data-highlighted:bg-destructive/10`}
              onClick={onRemove}
            >
              <XIcon aria-hidden="true" className="size-4 shrink-0" />
              Remove from trip
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
