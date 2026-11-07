"use client";

import type { RefObject } from "react";
import { memberPaymentState, personalTotals } from "@/lib/activity-expenses";
import type { ActivityLedger, Currency, Expense } from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";
import { expenseMoney } from "@/lib/money";

export function MyExpensesSummary({
  codes,
  ownExpenses,
  ledger,
  current,
  activityID,
  currency,
  triggerRef,
  setCost,
}: {
  codes: string[];
  ownExpenses: Expense[];
  ledger: ActivityLedger;
  current: Participant;
  activityID?: string;
  currency: (code: string) => Currency;
  triggerRef: RefObject<HTMLElement | null>;
  setCost: (cost: Expense | null) => void;
}) {
  return (
    <>
      {!codes.length && (
        <p className="text-muted-foreground">
          You have no expenses or balances for this activity.
        </p>
      )}
      {codes.map((code) => {
        const expenses = ownExpenses.filter((e) => e.currency === code);
        const totals = personalTotals(
          ledger,
          current.user_id,
          code,
          activityID,
        );
        const paid = expenses.reduce(
          (sum, e) => sum + memberPaymentState(e, ledger, current.user_id).paid,
          0n,
        );
        const money = (amount: bigint) =>
          expenseMoney(String(amount), currency(code));
        return (
          <div key={code} className="space-y-3">
            <dl className="personal-expense-summary">
              <div>
                <dt>Your share</dt>
                <dd>{money(totals.cost)}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{money(paid)}</dd>
              </div>
              <div>
                <dt>To pay</dt>
                <dd>{money(totals.remaining)}</dd>
              </div>
            </dl>
            {!!expenses.length && (
              <ul className="divide-y">
                {expenses.map((expense) => {
                  const status = memberPaymentState(
                    expense,
                    ledger,
                    current.user_id,
                  );
                  return (
                    <li key={expense.id}>
                      <button
                        type="button"
                        className="personal-expense-row"
                        aria-label={`View ${expense.description} payments`}
                        onClick={(event) => {
                          triggerRef.current = event.currentTarget;
                          setCost(expense);
                        }}
                      >
                        <span>
                          <strong>{expense.description}</strong>
                          <span className="block text-sm text-muted-foreground">
                            {status.status}
                            {status.remaining > 0n
                              ? ` · ${money(status.remaining)} left`
                              : ""}
                          </span>
                        </span>
                        <span className="tabular-nums">
                          {money(status.share)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}
