"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { ExpenseNumberInput } from "@/components/features/expenses/expense-number-input";
import { cn } from "cn";
import type { Currency } from "@/lib/expenses";
import { formatMoney, parseMoney } from "@/lib/money";

export function ExpensePriceField({
  currency,
  value,
  placeholder = (0).toFixed(currency.decimals),
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "value"> & {
  currency: Currency;
  value: string;
}) {
  let display = value;
  try {
    display = formatMoney(
      parseMoney(value, currency.decimals),
      currency,
    ).replace(`${currency.code} `, "");
  } catch {
    /* Keep an invalid draft visible for correction. */
  }
  return (
    <div className="reference-field group/expense-price grid min-w-0">
      <ExpenseNumberInput
        {...props}
        placeholder={placeholder}
        inputMode="decimal"
        value={value}
        className={cn(
          "col-start-1 row-start-1 min-w-0 not-focus:text-transparent!",
          className,
        )}
      />
      <span
        className="pointer-events-none col-start-1 row-start-1 grid min-w-0 items-center px-3 py-2 [overflow-wrap:anywhere] group-has-[input:focus]/expense-price:invisible"
        aria-hidden="true"
      >
        {display}
      </span>
    </div>
  );
}

export function ExpenseDateField({
  value,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "type"> & { value: string }) {
  const display = value
    ? new Intl.DateTimeFormat(undefined, {
        timeZone: "UTC",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00Z`))
    : "Choose a date";
  return (
    <div className="reference-field [position:relative] [min-width:0] reference-date-field [&>span]:[position:absolute] [&>span]:[inset:0] [&>span]:[display:flex] [&>span]:[align-items:center] [&>span]:[padding:0_12px] [&>span]:[pointer-events:none] [&>span]:[font-size:16px] [&>span]:[color:var(--foreground)] [&_input::-webkit-calendar-picker-indicator]:[opacity:0] [&_input:focus::-webkit-calendar-picker-indicator]:[opacity:1] [&_input:not(:focus)]:[color:transparent] [&:has(input:focus)_>_span]:[visibility:hidden]">
      <Input {...props} type="date" value={value} />
      <span aria-hidden="true">{display}</span>
    </div>
  );
}
