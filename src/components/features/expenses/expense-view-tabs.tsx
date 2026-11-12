"use client";

import { Tabs } from "@base-ui/react/tabs";
import type { ActivityExpenseView } from "@/components/features/expenses/activity-expenses";

const tab =
  "relative min-h-12 cursor-pointer px-1 pt-2.5 pb-3.5 text-base leading-6 text-muted-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring data-[active]:font-bold data-[active]:text-foreground data-[active]:hover:text-primary data-[active]:after:absolute data-[active]:after:inset-x-0 data-[active]:after:-bottom-px data-[active]:after:h-[3px] data-[active]:after:rounded-[3px] data-[active]:after:bg-primary data-[active]:after:content-['']";

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
      <Tabs.List
        aria-label="Expense views"
        activateOnFocus
        className="flex gap-7 border-b border-input"
      >
        <Tabs.Tab
          className={tab}
          id={`expense-details-${activityID}`}
          value="details"
          aria-controls={`expense-panel-${activityID}`}
        >
          All expenses
        </Tabs.Tab>
        <Tabs.Tab
          className={tab}
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
