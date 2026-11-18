import type { ComponentProps } from "react";
import { cn } from "cn";

export function ExpenseMoneyRow({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="expense-money-row"
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_minmax(0,42%)] items-center gap-x-4 gap-y-1 border-b border-border py-1 [overflow-wrap:anywhere] [&>.reference-field]:text-right [&>:last-child]:text-right [&>:last-child]:tabular-nums [&_[data-slot=input]]:min-h-12 [&_[data-slot=input]]:px-2 [&_[data-slot=input]]:text-right",
        className,
      )}
    />
  );
}

export function ExpenseSummary({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "grid min-h-0 gap-3 border-t border-border pt-4 text-sm leading-[1.6] [overflow-wrap:anywhere] [&_h3]:text-base [&_h3]:leading-normal [&_h3]:font-semibold",
        className,
      )}
    />
  );
}
