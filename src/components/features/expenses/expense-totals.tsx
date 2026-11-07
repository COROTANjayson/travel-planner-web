"use client";

import { personalTotals } from "@/lib/activity-expenses";
import type { ActivityLedger, Expense } from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";

export function ExpenseTotals({
  codes,
  costs,
  data,
  current,
  activityID,
  money,
}: {
  codes: string[];
  costs: Expense[];
  data: ActivityLedger;
  current?: Participant;
  activityID: string;
  money: (amount: string | bigint, currency: string) => string;
}) {
  return (
    <>
      {codes.map((code) => {
        const total = costs
          .filter((e) => e.currency === code)
          .reduce((n, e) => n + BigInt(e.amount_minor), 0n);
        const own = personalTotals(
          data,
          current?.user_id ?? 0,
          code,
          activityID,
        );
        return (
          <div key={code} className="activity-cost-total">
            <div>
              <p className="text-xs text-muted-foreground">Estimated total</p>
              <p className="text-xl font-semibold">{money(total, code)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your share</p>
              <p className="text-xl font-semibold">{money(own.cost, code)}</p>
            </div>
          </div>
        );
      })}
    </>
  );
}
