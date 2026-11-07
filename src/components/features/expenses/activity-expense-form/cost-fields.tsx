"use client";

import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActivityLedger, Currency, Expense } from "@/lib/expenses";

export function CostFields({
  description,
  setDescription,
  activity,
  setActivity,
  activityOptions,
  basis,
  setBasis,
  setMode,
  amount,
  setAmount,
  currency,
  setCurrency,
  currencies,
  record,
  ledger,
  changed,
}: {
  description: string;
  setDescription: (description: string) => void;
  activity: string;
  setActivity: (activity: string) => void;
  activityOptions: { value: string; label: string }[];
  basis: "group" | "per_person";
  setBasis: (basis: "group" | "per_person") => void;
  setMode: (mode: "equal" | "exact") => void;
  amount: string;
  setAmount: (amount: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  currencies: Currency[];
  record?: Expense;
  ledger: ActivityLedger;
  changed: () => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="cost-description">What’s this expense for?</Label>
        <Input
          id="cost-description"
          placeholder="Entrance, a room, a meal…"
          required
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoFocus
        />
      </div>
      {!activity && (
        <ExpenseSelect
          id="cost-activity"
          label="Activity"
          value={activity}
          options={[
            { value: "", label: "Choose an activity" },
            ...activityOptions,
          ]}
          onChange={(v) => {
            setActivity(v);
            changed();
          }}
        />
      )}
      <div className="expense-amount-fields">
        <div className="space-y-2">
          <Label htmlFor="cost-amount">
            Amount{basis === "per_person" ? " per person" : ""} · {currency}
          </Label>
          <Input
            className="expense-amount-input"
            id="cost-amount"
            placeholder="0.00"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <ExpenseSelect
          id="cost-currency"
          label="Currency"
          value={currency}
          disabled={
            !!record && ledger.payments.some((p) => p.expense_id === record.id)
          }
          options={currencies.map((c) => ({
            value: c.code,
            label: c.code,
          }))}
          onChange={(v) => {
            setCurrency(v);
            changed();
          }}
        />
      </div>
      <fieldset className="expense-choice" aria-label="Amount type">
        <legend className="sr-only">Amount type</legend>
        {[
          { value: "group", label: "Group total" },
          { value: "per_person", label: "Per person" },
        ].map((option) => (
          <label key={option.value}>
            <input
              id={`cost-basis-${option.value}`}
              type="radio"
              name="amount-basis"
              checked={basis === option.value}
              onChange={() => {
                setBasis(option.value as typeof basis);
                if (option.value === "per_person") setMode("equal");
                changed();
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    </>
  );
}
