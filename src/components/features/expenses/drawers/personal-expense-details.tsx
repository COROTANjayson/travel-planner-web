"use client";

import { rowDetail, rowTitle } from "@/components/features/expenses/card-row";
import { activityPlace } from "@/components/features/expenses/expense-list-parts";
import { CategoryBadge } from "@/components/features/itinerary/category-badge";
import { TripDialog } from "@/components/shared/trip-dialog";
import { Button } from "@/components/ui/button";
import { fullDateLabel } from "@/lib/activity-time";
import type { Activity } from "@/lib/itinerary";
import type { PersonalExpense } from "@/lib/personal-expenses";
import { categoryOf } from "@/lib/expense-views";

export function PersonalExpenseDetails({
  record,
  activities,
  money,
  pending,
  onEdit,
  onDelete,
  onBack,
  finalFocus,
}: {
  record: PersonalExpense;
  activities: Activity[];
  money: (amount: string | bigint, currency: string) => string;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
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
      title={record.description}
      titleAccessory={
        <CategoryBadge category={categoryOf(record, activities)} />
      }
      description="Personal expense"
      bodyClassName="space-y-4 md:space-y-5"
      footerClassName="border-t pt-4 pb-4"
      onBack={onBack}
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="link"
            className="text-destructive"
            disabled={pending}
            onClick={onDelete}
          >
            Delete
          </Button>
          <Button
            variant="outline"
            className="justify-center!"
            disabled={pending}
            onClick={onEdit}
          >
            Edit
          </Button>
        </div>
      }
    >
      <p className="text-4xl leading-[1.25] font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] md:text-5xl">
        {money(record.amount_minor, record.currency)}
      </p>
      <dl className="divide-y overflow-hidden rounded-[16px] border bg-card">
        {[
          ["Activity", activityPlace(record, activities)],
          [
            "Date",
            `${fullDateLabel(record.incurred_on)}, ${Number(record.incurred_on.slice(0, 4))}`,
          ],
          ["Who can see this", "Only you"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col-reverse gap-0.5 px-3.5 py-3 [overflow-wrap:anywhere] sm:p-4"
          >
            <dt className={rowDetail}>{label}</dt>
            <dd className={rowTitle}>{value}</dd>
          </div>
        ))}
      </dl>
    </TripDialog>
  );
}
