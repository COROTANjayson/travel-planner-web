"use client";

import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CostDateDetails({
  date,
  setDate,
  activity,
  setActivity,
  activityOptions,
  changed,
}: {
  date: string;
  setDate: (date: string) => void;
  activity: string;
  setActivity: (activity: string) => void;
  activityOptions: { value: string; label: string }[];
  changed: () => void;
}) {
  return (
    <details className="expense-extra">
      <summary>Date &amp; activity</summary>
      <div className="expense-detail-fields pt-4">
        <div className="space-y-2">
          <Label htmlFor="cost-date">Cost date</Label>
          <Input
            id="cost-date"
            type="date"
            required
            min="0001-01-01"
            max="9999-12-31"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {!!activity && (
          <ExpenseSelect
            id="cost-activity"
            label="Activity"
            value={activity}
            options={activityOptions}
            onChange={(v) => {
              setActivity(v);
              changed();
            }}
          />
        )}
      </div>
    </details>
  );
}
