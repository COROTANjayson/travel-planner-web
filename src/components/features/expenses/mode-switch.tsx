"use client";

import type { ReactNode, RefObject } from "react";
import { UserIcon, UsersIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export type ExpenseMode = "group" | "personal";

/** Changes everything below it on the trip Expenses page. */
export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: ExpenseMode;
  onChange: (mode: ExpenseMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Expenses view"
      className="flex gap-1 rounded-full bg-muted p-1 max-md:w-full"
    >
      {(["group", "personal"] as const).map((value) => {
        const Icon = value === "group" ? UsersIcon : UserIcon;
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            aria-pressed={mode === value}
            className="min-h-11 gap-2 px-5 font-semibold text-muted-foreground hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground max-md:flex-1 md:min-h-10 [&_svg]:size-[18px]!"
            onClick={() => onChange(value)}
          >
            <Icon aria-hidden="true" />
            {value === "group" ? "Group" : "Personal"}
          </Button>
        );
      })}
    </div>
  );
}

/** The page heading and mode switch, with the mode's own actions beside them. */
export function ExpensesHeading({
  headingRef,
  mode,
  onModeChange,
  children,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  mode: ExpenseMode;
  onModeChange: (mode: ExpenseMode) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <h2
        id="trip-expenses-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-[22px] leading-7 font-semibold tracking-[-0.01em] outline-none max-md:sr-only"
      >
        Expenses
      </h2>
      <ModeSwitch mode={mode} onChange={onModeChange} />
      {children && <div className="max-md:hidden md:ml-auto">{children}</div>}
    </div>
  );
}
