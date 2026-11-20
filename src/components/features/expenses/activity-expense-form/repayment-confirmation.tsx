"use client";

import { ExpenseAmountPanel } from "@/components/features/expenses/expense-amount-panel";

import { UserIcon } from "@phosphor-icons/react";
import { ExpenseNumberInput } from "@/components/features/expenses/expense-number-input";
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
          <UserIcon className="size-5" aria-hidden="true" />
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
      <ExpenseAmountPanel
        inputID="cost-amount"
        label="Amount received"
        currency={<span id="repayment-currency">{currency.code}</span>}
        footer={
          <>
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
          </>
        }
      >
        <ExpenseNumberInput
          id="cost-amount"
          required
          inputMode="decimal"
          placeholder={(0).toFixed(currency.decimals)}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-invalid={!!error}
          aria-describedby="repayment-currency repayment-balance repayment-error"
        />
      </ExpenseAmountPanel>
    </div>
  );
}
