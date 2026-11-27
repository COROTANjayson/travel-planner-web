"use client";

import { rowDetail, rowTitle } from "@/components/features/expenses/card-row";
import { paidOnLabel } from "@/components/features/expenses/drawers/payment-workspace/payment-history";
import { DetailTotals } from "@/components/features/expenses/expense-list-parts";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import { TripDialog } from "@/components/shared/trip-dialog";
import { Button } from "@/components/ui/button";
import { dateLabel } from "@/lib/activity-time";
import { loanLeft } from "@/lib/expense-views";
import type { ActivityLedger, Loan } from "@/lib/expenses";
import type { Activity } from "@/lib/itinerary";
import { categoryOf } from "@/lib/expense-views";

export function LoanDetails({
  loan,
  ledger,
  activities,
  name,
  money,
  canReceive,
  canRemove,
  pending,
  onReceive,
  onRemove,
  onBack,
  finalFocus,
}: {
  loan: Loan;
  ledger: ActivityLedger;
  activities: Activity[];
  name: (id: number) => string;
  money: (amount: string | bigint, currency: string) => string;
  canReceive: boolean;
  canRemove: boolean;
  pending: boolean;
  onReceive: () => void;
  onRemove: () => void;
  onBack: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const left = loanLeft(ledger, loan);
  const repayments = ledger.settlements
    .filter((s) => s.loan_id === loan.id)
    .sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.id - a.id);
  const removable = canRemove && !repayments.length;
  const receivable = canReceive && left > 0n;
  return (
    <TripDialog
      open
      presentation="detail"
      variant="expense"
      mobilePresentation="tall-sheet"
      backLabel="Back to expenses"
      backdropClassName="bg-black/60"
      title={loan.description}
      titleAccessory={<CategoryBadge category={categoryOf(loan, activities)} />}
      description={`Lent to ${name(loan.to_user_id)} · ${dateLabel(loan.paid_on)}`}
      bodyClassName="space-y-4 md:space-y-5"
      footerClassName="border-t pt-4 pb-4"
      onBack={onBack}
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
      footer={
        (removable || receivable) && (
          <div className="flex items-center justify-between gap-3">
            {removable && (
              <Button
                variant="link"
                className="text-destructive"
                disabled={pending}
                onClick={onRemove}
              >
                Remove
              </Button>
            )}
            {receivable && (
              <Button
                className="ml-auto justify-center!"
                disabled={pending}
                onClick={onReceive}
              >
                Record repayment
              </Button>
            )}
          </div>
        )
      }
    >
      <DetailTotals
        items={[
          ["You lent", money(loan.amount_minor, loan.currency)],
          [
            left < 0n ? "Credit for review" : "Left to get back",
            money(left < 0n ? -left : left, loan.currency),
          ],
        ]}
      />
      <section aria-label="Repayments" className="space-y-3">
        <h3 className={rowTitle}>Repayments</h3>
        {repayments.length ? (
          <ul className="divide-y overflow-hidden rounded-[16px] border bg-card">
            {repayments.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-3.5 py-3 [overflow-wrap:anywhere] sm:p-4"
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className={rowTitle}>
                    {name(r.from_user_id)} paid you
                  </span>
                  <span className={rowDetail}>{paidOnLabel(r.paid_on)}</span>
                </span>
                <span
                  className={`max-w-[50%] text-right tabular-nums ${rowTitle}`}
                >
                  {money(r.amount_minor, r.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-5 text-muted-foreground">
            No repayments yet.
          </p>
        )}
        {repayments.length > 0 && canRemove && (
          <p className="text-sm leading-5 text-muted-foreground">
            Correct or reverse a repayment in Balances and history. Reverse all
            of them to remove this loan.
          </p>
        )}
      </section>
    </TripDialog>
  );
}
