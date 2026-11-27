"use client";

import { ActivityExpenses } from "@/components/features/expenses/activity-expenses";
import type { Context } from "@/components/features/expenses/use-finance";
import { TripDialog } from "@/components/shared/trip-dialog";

/** Borrowed money, reimbursements, repayments and corrections for the whole trip. */
export function ExpenseHistoryDrawer({
  onBack,
  finalFocus,
  ...context
}: Context & {
  onBack: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  return (
    <TripDialog
      open
      presentation="detail"
      variant="expense"
      mobilePresentation="tall-sheet"
      backLabel="Back to expenses"
      backdropClassName="bg-black/60"
      title="Balances and history"
      onBack={onBack}
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
    >
      <ActivityExpenses
        {...context}
        activityID=""
        activityTitle="Balances and history"
        view="history"
      />
    </TripDialog>
  );
}
