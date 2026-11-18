import type { ComponentProps } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export function ExpenseNumberInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      inputMode="decimal"
      className={cn(
        "rounded-none! border-0 border-b border-[var(--money-border,var(--input))] bg-transparent! px-0 py-2 text-inherit [font:inherit] [text-align:inherit] tabular-nums caret-[var(--money-focus,var(--primary))] placeholder:text-[var(--money-border,var(--muted-foreground))] placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-150 placeholder:ease-[cubic-bezier(0.23,1,0.32,1)] [box-shadow:none]! focus:outline-none! focus:placeholder:opacity-0 focus-visible:border-b-2 focus-visible:border-[var(--money-focus,var(--primary))]! aria-invalid:border-[var(--money-error,var(--destructive))]! selection:bg-[var(--aqua)] selection:text-[var(--ocean)] motion-reduce:placeholder:transition-none motion-reduce:placeholder:duration-0",
        className,
      )}
    />
  );
}
