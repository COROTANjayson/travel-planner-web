"use client";

import { UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { expenseMoney } from "@/lib/money";
import type { Currency, Debt } from "@/lib/expenses";

export function RepaymentConfirmation({
  debt,
  person,
  currency,
  amount,
  setAmount,
  remaining,
  error,
}: {
  debt: Debt;
  person: string;
  currency: Currency;
  amount: string;
  setAmount: (value: string) => void;
  remaining: bigint | null;
  error: string;
}) {
  const money = (value: string) => expenseMoney(value, currency);
  return (
    <div className="repayment-confirmation mx-auto max-w-lg space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          <UserRound className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
          <div>
            <p className="text-xs leading-5 text-muted-foreground">From</p>
            <p className="text-base leading-6 font-semibold">{person}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm leading-5 font-medium">{debt.description}</p>
            {debt.activity_name && (
              <p className="text-sm leading-5 text-muted-foreground">
                {debt.activity_name}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="repayment-panel [background:var(--ocean)] [color:var(--ocean-text)] rounded-xl p-5 sm:p-6 [&_strong]:[color:#fff] [&_.repayment-error]:[color:#ffd5ca] [&_.repayment-error:not(:empty)]:[margin-top:12px] max-md:[&]:[padding:16px]">
        <div className="flex items-center justify-between gap-3">
          <Label
            htmlFor="cost-amount"
            className="text-sm leading-5 font-medium"
          >
            Amount received
          </Label>
          <span
            className="repayment-currency text-xs font-semibold [&]:[border:1px_solid_var(--ocean-text)] [&]:[border-radius:6px] [&]:[padding:2px_8px]"
            id="repayment-currency"
          >
            {currency.code}
          </span>
        </div>
        <div className="mx-auto mt-4 w-full max-w-64">
          <Input
            id="cost-amount"
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="repayment-amount-input border-0 border-b bg-transparent px-0 py-2 text-center text-6xl leading-tight font-semibold tracking-tight tabular-nums"
            aria-invalid={!!error}
            aria-describedby="repayment-currency repayment-balance repayment-error"
          />
        </div>
        <p
          id="repayment-error"
          className="repayment-error text-sm leading-5"
          role="status"
        >
          {error}
        </p>
        <p
          id="repayment-balance"
          className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm leading-6"
          role="status"
        >
          <span>Left to receive:</span>
          <strong className="text-lg font-semibold tabular-nums">
            {money(
              remaining !== null && remaining >= 0n
                ? String(remaining)
                : debt.amount_minor,
            )}
          </strong>
        </p>
      </div>
    </div>
  );
}
