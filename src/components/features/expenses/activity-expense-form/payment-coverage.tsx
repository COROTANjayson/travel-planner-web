"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
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
      <div className="space-y-2 rounded-xl bg-secondary p-4">
        <p className="font-medium">Payment covers</p>
        {(manual ? paymentRemaining : preview).map((s) => (
          <div
            key={s.user_id}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span>
              {expenseName(people.find((p) => p.user_id === s.user_id))}
              {s.user_id === payer ? " (own share)" : ""}
            </span>
            {manual ? (
              <Input
                aria-label={`Coverage for ${expenseName(people.find((p) => p.user_id === s.user_id))}`}
                className="w-32"
                inputMode="decimal"
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
          </div>
        ))}
        <p className="text-sm" aria-live="polite">
          {previewError ||
            "Included in the original cost. Other travelers reimburse the payer for their covered shares."}
        </p>
      </div>
    </>
  );
}
