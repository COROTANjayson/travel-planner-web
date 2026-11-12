"use client";

import type { ActivityExpenseView } from "@/components/features/expenses/activity-expenses";
import { personalTotals } from "@/lib/activity-expenses";
import type { ActivityLedger, Expense } from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";

// Outside the finance drawer ("plain") the totals sit in a ruled two-column row;
// inside it they become a card (details) or a plain grid (overview).
export const totalsStyles = {
  plain: {
    root: "grid grid-cols-[1.3fr_0.7fr] gap-4 border-b border-border pb-2.5 max-[359px]:grid-cols-2",
    cell: "",
    label: "text-sm leading-[22px] text-muted-foreground",
    value: "mt-1 text-[26px] leading-9 font-bold",
  },
  overview: {
    root: "grid grid-cols-2 gap-4",
    cell: "block min-w-0 [overflow-wrap:anywhere]",
    label: "m-0 text-sm leading-[22px] font-normal text-muted-foreground",
    value:
      "mt-0.5 mb-0 text-xl leading-7 font-semibold text-foreground tabular-nums",
  },
  details: {
    root: "grid grid-cols-2 gap-4 rounded-[16px] bg-secondary p-4",
    cell: "grid min-w-0 grid-rows-[1fr_auto] gap-0 [overflow-wrap:anywhere]",
    label: "m-0 text-sm leading-[22px] font-normal text-muted-foreground",
    value: "mt-1 mb-0 text-[22px] leading-[30px] font-semibold tabular-nums",
  },
};

export function ExpenseTotals({
  codes,
  costs,
  data,
  current,
  activityID,
  money,
  view,
}: {
  codes: string[];
  costs: Expense[];
  data: ActivityLedger;
  current?: Participant;
  activityID: string;
  money: (amount: string | bigint, currency: string) => string;
  view?: ActivityExpenseView;
}) {
  const s =
    totalsStyles[view === "overview" || view === "details" ? view : "plain"];
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
          <div key={code} className={s.root}>
            <div className={s.cell}>
              <p className={s.label}>Estimated total</p>
              <p className={s.value}>{money(total, code)}</p>
            </div>
            <div className={s.cell}>
              <p className={s.label}>Your share</p>
              <p className={s.value}>{money(own.cost, code)}</p>
            </div>
          </div>
        );
      })}
    </>
  );
}
