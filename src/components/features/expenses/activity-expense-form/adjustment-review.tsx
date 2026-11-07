"use client";

import type { RefObject } from "react";
import { memberPaymentState } from "@/lib/activity-expenses";
import {
  expenseName,
  type ActivityLedger,
  type Expense,
  type ExpensePerson,
} from "@/lib/expenses";

export function AdjustmentReview({
  feedback,
  record,
  total,
  preview,
  ledger,
  people,
  money,
}: {
  feedback: RefObject<HTMLDivElement | null>;
  record: Expense;
  total: string;
  preview: { user_id: number; amount_minor: string }[];
  ledger: ActivityLedger;
  people: ExpensePerson[];
  money: (value: string) => string;
}) {
  return (
    <div
      ref={feedback}
      tabIndex={-1}
      className="space-y-2 rounded-xl border p-4"
      role="status"
    >
      <p className="font-medium">Review adjustment before saving</p>
      <p>
        Cost: {money(record.amount_minor)} → {money(total)}
      </p>
      {preview.map((s) => (
        <p key={s.user_id}>
          {expenseName(people.find((p) => p.user_id === s.user_id))}:{" "}
          {money(
            record.shares.find((old) => old.user_id === s.user_id)
              ?.amount_minor ?? "0",
          )}{" "}
          → {money(s.amount_minor)}
        </p>
      ))}
      {[
        ...new Set([
          ...record.shares.map((s) => s.user_id),
          ...preview.map((s) => s.user_id),
          ...ledger.payments
            .filter((p) => p.expense_id === record.id)
            .flatMap((p) => p.allocations.map((a) => a.user_id)),
        ]),
      ].map((id) => {
        const before = memberPaymentState(record, ledger, id);
        const after = memberPaymentState(
          { ...record, amount_minor: total, shares: preview },
          ledger,
          id,
        );
        return (
          <p key={`balance-${id}`} className="text-sm">
            {expenseName(people.find((p) => p.user_id === id))}: still to pay{" "}
            {money(before.remaining.toString())} →{" "}
            {money(after.remaining.toString())}; credit{" "}
            {money(before.credit.toString())} → {money(after.credit.toString())}
          </p>
        );
      })}
      <p className="text-sm">
        Recorded payments stay unchanged. Excess coverage becomes a credit for
        review.
      </p>
    </div>
  );
}
