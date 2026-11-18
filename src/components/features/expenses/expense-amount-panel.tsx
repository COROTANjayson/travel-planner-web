import type { ReactNode } from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";
import { fieldRequired } from "@/components/shared/field-required";

export function ExpenseAmountPanel({
  inputID,
  label,
  currency,
  children,
  footer,
  required,
}: {
  inputID: string;
  label: string;
  currency: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  required?: boolean;
}) {
  return (
    <div
      data-slot="expense-amount-panel"
      className="min-w-0 rounded-2xl bg-[var(--ocean)] p-5 text-[var(--ocean-text)] [--money-border:var(--ocean-text)] [--money-error:#ffd5ca] [--money-focus:var(--aqua)] sm:p-6"
    >
      <div className="flex items-center justify-between gap-4 [&_[data-slot=label]]:text-sm [&_[data-slot=label]]:font-medium [&_[data-slot=label]]:text-inherit">
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
        className="mx-auto mt-6 mb-2 w-full max-w-sm text-center text-6xl leading-tight font-semibold tracking-tight [&_[data-slot=input]]:min-h-20! [&_.reference-field>span]:px-0"
      >
        {children}
      </div>
      {footer && (
        <div className="mt-5 text-sm [overflow-wrap:anywhere] [&_strong]:text-white [&_.repayment-error]:text-[#ffd5ca]">
          {footer}
        </div>
      )}
    </div>
  );
}
