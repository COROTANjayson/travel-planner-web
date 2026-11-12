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
    <details className="expense-extra [border-top:1px_solid_var(--border)] [padding-top:0.75rem] [&>summary]:[min-height:2.75rem] [&>summary]:[align-content:center] [&>summary]:[font-size:0.875rem] [&>summary]:[font-weight:500] [&>summary]:[cursor:pointer] [&_>_summary_>_span]:[margin-left:0.5rem]">
      <summary>Date &amp; activity</summary>
      <div className="expense-detail-fields [display:grid] [gap:1rem] pt-4 min-[600px]:[&]:[grid-template-columns:repeat(2,_minmax(0,_1fr))]">
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
