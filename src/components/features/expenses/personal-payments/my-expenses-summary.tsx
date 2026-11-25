"use client";

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
}: {
  codes: string[];
  ownExpenses: Expense[];
  ledger: ActivityLedger;
  current: Participant;
  activityID?: string;
  currency: (code: string) => Currency;
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
          <dl
            key={code}
            className="personal-expense-summary grid grid-cols-[repeat(3,minmax(max-content,1fr))] gap-4 overflow-x-auto rounded-[16px] bg-secondary p-4 [&_dd]:mt-1 [&_dd]:text-[15px] [&_dd]:leading-5 [&_dd]:font-semibold [&_dd]:whitespace-nowrap [&_dd]:tabular-nums sm:[&_dd]:text-base sm:[&_dd]:leading-[22px] [&_dt]:text-sm [&_dt]:leading-5 [&_dt]:text-muted-foreground"
          >
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
        );
      })}
    </>
  );
}
