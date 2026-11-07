"use client";

import { Tabs } from "@base-ui/react/tabs";
import type { ActivityExpenseView } from "@/components/features/expenses/activity-expenses";

export function ExpenseViewTabs({
  view,
  activityID,
  onViewChange,
}: {
  view?: ActivityExpenseView;
  activityID: string;
  onViewChange?: (view: ActivityExpenseView) => void;
}) {
  return (
    <Tabs.Root
      className="activity-finance-tabs"
      value={view}
      onValueChange={(value) => {
        if (value === "details" || value === "personal") onViewChange?.(value);
      }}
    >
      <Tabs.List aria-label="Expense views" activateOnFocus>
        <Tabs.Tab
          id={`expense-details-${activityID}`}
          value="details"
          aria-controls={`expense-panel-${activityID}`}
        >
          All expenses
        </Tabs.Tab>
        <Tabs.Tab
          id={`expense-personal-${activityID}`}
          value="personal"
          aria-controls={`expense-panel-${activityID}`}
        >
          My expenses
        </Tabs.Tab>
      </Tabs.List>
    </Tabs.Root>
  );
}
