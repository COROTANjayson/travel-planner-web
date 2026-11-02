"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import type { Currency } from "@/lib/expenses";
import { formatMoney, parseMoney } from "@/lib/money";

export function ExpensePriceField({
  currency,
  value,
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
    <div className="reference-field">
      <Input {...props} inputMode="decimal" value={value} />
      <span aria-hidden="true">{display}</span>
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
    <div className="reference-field reference-date-field">
      <Input {...props} type="date" value={value} />
      <span aria-hidden="true">{display}</span>
    </div>
  );
}
