import type { ReactNode } from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";
import { fieldRequired } from "@/components/shared/field-required";

// Figma "Amount panel": label + currency, the big amount, an optional basis
// toggle, then a live share/status line.
export function ExpenseAmountPanel({
  inputID,
  label,
  currency,
  children,
  toggle,
  footer,
  required,
}: {
  inputID: string;
  label: string;
  currency: ReactNode;
  children: ReactNode;
  toggle?: ReactNode;
  footer?: ReactNode;
  required?: boolean;
}) {
  return (
    <div
      data-slot="expense-amount-panel"
      className="grid min-w-0 justify-items-center gap-4 rounded-[16px] bg-[var(--ocean)] p-5 text-[var(--ocean-text)] [--money-border:var(--ocean-text)] [--money-error:#ffd5ca] [--money-focus:var(--aqua)]"
    >
      <div className="flex w-full items-center justify-between gap-4 [&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-medium [&_[data-slot=label]]:text-inherit">
        <Label
          htmlFor={inputID}
          className={cn(required && fieldRequired, "after:text-[#ffd5ca]")}
        >
          {label}
        </Label>
        <div className="shrink-0 text-xs font-semibold [&>span]:inline-block [&>span]:rounded-md [&>span]:border [&>span]:border-current [&>span]:px-2 [&>span]:py-0.5 [&_[data-slot=select-trigger]]:min-h-11 [&_[data-slot=select-trigger]]:w-auto [&_[data-slot=select-trigger]]:rounded-lg [&_[data-slot=select-trigger]]:border-current [&_[data-slot=select-trigger]]:bg-transparent [&_[data-slot=select-trigger]]:px-2.5 [&_[data-slot=select-trigger]]:text-inherit [&_[data-slot=select-trigger]:focus-visible]:shadow-none [&_[data-slot=select-trigger]:focus-visible]:outline-2 [&_[data-slot=select-trigger]:focus-visible]:outline-offset-4 [&_[data-slot=select-trigger]:focus-visible]:outline-[var(--aqua)] [&_label]:sr-only">
          {typeof currency === "string" ? <span>{currency}</span> : currency}
        </div>
      </div>
      <div
        data-slot="expense-amount-control"
        className="w-full max-w-[280px] text-center text-[36px] leading-[43px] font-semibold tracking-tight sm:text-5xl sm:leading-[60px] [&_.reference-field>span]:px-0 [&_[data-slot=input]]:min-h-16!"
      >
        {children}
      </div>
      {toggle}
      {footer && (
        <div className="w-full text-center text-sm [overflow-wrap:anywhere] [&_strong]:text-white [&_.repayment-error]:text-[#ffd5ca]">
          {footer}
        </div>
      )}
    </div>
  );
}
