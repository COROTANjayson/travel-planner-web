"use client";

import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { Button } from "@/components/ui/button";
import type { ActivityLedger } from "@/lib/expenses";

export function OtherBalances({
  activityID,
  data,
  isEditor,
  name,
  money,
  open,
  showHistory,
}: {
  activityID: string;
  data: ActivityLedger;
  isEditor: boolean;
  name: (id: number) => string;
  money: (amount: string | bigint, currency: string) => string;
  open: (next: ExpenseEditor) => void;
  showHistory: (id: number) => Promise<void>;
}) {
  return (
    <details>
      <summary className="min-h-11 cursor-pointer text-sm">
        Other balances and historical receipts
      </summary>
      <div className="space-y-3 text-sm">
        {activityID === "unassigned" &&
          data.settlements
            .filter((s) => !s.payment_id && !s.loan_id)
            .map((s) => (
              <div key={s.id}>
                <p>
                  {name(s.from_user_id)} → {name(s.to_user_id)} ·{" "}
                  {money(s.amount_minor, s.currency)} · Trip-level receipt
                  awaiting association
                </p>
                {isEditor && (
                  <Button
                    variant="outline"
                    onClick={() => open({ type: "repayment", receipt: s })}
                  >
                    Associate existing receipt
                  </Button>
                )}
              </div>
            ))}
        {(data.reversed_settlements ?? []).map((s) => (
          <div key={`reversed-${s.id}`} className="border-t pt-3">
            <p>
              Reversed receipt: {name(s.from_user_id)} → {name(s.to_user_id)} ·{" "}
              {money(s.amount_minor, s.currency)}
            </p>
            <Button variant="ghost" onClick={() => void showHistory(s.id)}>
              Receipt history
            </Button>
          </div>
        ))}
        <p className="text-muted-foreground">
          These records remain part of the trip’s balances.
        </p>
      </div>
    </details>
  );
}
