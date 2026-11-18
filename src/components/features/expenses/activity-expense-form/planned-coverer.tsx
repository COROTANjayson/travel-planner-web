"use client";

import { ExpenseAmountPanel } from "@/components/features/expenses/expense-amount-panel";

import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { ExpenseNumberInput } from "@/components/features/expenses/expense-number-input";
import {
  expenseName,
  type Currency,
  type Expense,
  type ExpensePerson,
} from "@/lib/expenses";

export function PlannedCoverer({
  record,
  people,
  currentUserIDs,
  plannedCoverer,
  setPlannedCoverer,
  plannedAmount,
  setPlannedAmount,
  currency,
  changed,
}: {
  record?: Expense;
  people: ExpensePerson[];
  currentUserIDs: number[];
  plannedCoverer: number;
  setPlannedCoverer: (coverer: number) => void;
  plannedAmount: string;
  setPlannedAmount: (amount: string) => void;
  currency: Currency;
  changed: () => void;
}) {
  return (
    <details
      className="expense-extra [border-top:1px_solid_var(--border)] [padding-top:0.75rem] [&>summary]:[min-height:2.75rem] [&>summary]:[align-content:center] [&>summary]:[font-size:0.875rem] [&>summary]:[font-weight:500] [&>summary]:[cursor:pointer] [&_>_summary_>_span]:[margin-left:0.5rem]"
      open={record?.planned_coverer_user_id ? true : undefined}
    >
      <summary>
        Plan who pays first{" "}
        <span className="text-muted-foreground font-normal">Optional</span>
      </summary>
      <div className="space-y-4 pt-4">
        <ExpenseSelect
          id="planned-coverer"
          label="Who will cover the advance?"
          value={String(plannedCoverer)}
          options={[
            { value: "0", label: "Decide later" },
            ...people
              .filter(
                (person) =>
                  currentUserIDs.includes(person.user_id) ||
                  person.user_id === record?.planned_coverer_user_id,
              )
              .map((person) => ({
                value: String(person.user_id),
                label: expenseName(person),
              })),
          ]}
          onChange={(v) => {
            setPlannedCoverer(Number(v));
            changed();
          }}
        />
        {!!plannedCoverer && (
          <div className="space-y-3">
            <ExpenseAmountPanel
              inputID="planned-amount"
              label="Planned amount"
              currency={currency.code}
            >
              <ExpenseNumberInput
                id="planned-amount"
                inputMode="decimal"
                placeholder={(0).toFixed(currency.decimals)}
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(e.target.value)}
              />
            </ExpenseAmountPanel>
            <p className="text-sm text-muted-foreground">
              A reservation or deposit someone will cover. This stays a plan
              until a planner/editor confirms the payment.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}
