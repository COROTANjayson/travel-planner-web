"use client";

import { ExpenseMoneyRow } from "@/components/features/expenses/expense-layout";

import type { Dispatch, SetStateAction } from "react";
import { ExpenseNumberInput } from "@/components/features/expenses/expense-number-input";
import { expenseName, type Currency, type ExpensePerson } from "@/lib/expenses";
import { moneyInput } from "@/lib/money";

export function PaymentCoverage({
  manual,
  setManual,
  allocation,
  setAllocation,
  preview,
  previewError,
  paymentRemaining,
  people,
  payer,
  meta,
  money,
}: {
  manual: boolean;
  setManual: (manual: boolean) => void;
  allocation: Record<number, string>;
  setAllocation: Dispatch<SetStateAction<Record<number, string>>>;
  preview: { user_id: number; amount_minor: string }[];
  previewError: string;
  paymentRemaining: { user_id: number; amount_minor: string }[];
  people: ExpensePerson[];
  payer: number;
  meta: Currency;
  money: (value: string) => string;
}) {
  return (
    <>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          checked={manual}
          onChange={(e) => {
            setAllocation(
              Object.fromEntries(
                preview.map((s) => [
                  s.user_id,
                  moneyInput(s.amount_minor, meta.decimals),
                ]),
              ),
            );
            setManual(e.target.checked);
          }}
        />
        Adjust coverage manually
      </label>
      <div className="grid gap-3">
        <p className="font-medium">Payment covers &middot; {meta.code}</p>
        {(manual ? paymentRemaining : preview).map((s) => (
          <ExpenseMoneyRow key={s.user_id}>
            <span>
              {expenseName(people.find((p) => p.user_id === s.user_id))}
              {s.user_id === payer ? " (own share)" : ""}
            </span>
            {manual ? (
              <ExpenseNumberInput
                aria-label={`Coverage for ${expenseName(people.find((p) => p.user_id === s.user_id))}`}
                inputMode="decimal"
                placeholder={(0).toFixed(meta.decimals)}
                value={allocation[s.user_id] ?? "0"}
                onChange={(e) =>
                  setAllocation((v) => ({
                    ...v,
                    [s.user_id]: e.target.value,
                  }))
                }
              />
            ) : (
              <span>{money(s.amount_minor)}</span>
            )}
          </ExpenseMoneyRow>
        ))}
        <p className="text-sm" aria-live="polite">
          {previewError ||
            "Included in the original cost. Other travelers reimburse the payer for their covered shares."}
        </p>
      </div>
    </>
  );
}
