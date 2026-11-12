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
      <div className="expense-amount-fields [display:grid] [grid-template-columns:minmax(0,_1fr)_7rem] [align-items:end] [gap:0.75rem] [&_.expense-amount-input]:[min-height:3.5rem] [&_.expense-amount-input]:[font-size:1.75rem] [&_.expense-amount-input]:[font-weight:600] [&_.expense-amount-input]:[font-variant-numeric:tabular-nums] [&_[data-slot='select-trigger']]:[min-height:3.5rem]">
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
      <fieldset
        className="expense-choice [display:flex] [gap:0.25rem] [padding:0.25rem] [border-radius:0.875rem] [background:var(--secondary)] [&>label]:[position:relative] [&>label]:[display:flex] [&>label]:[flex:1] [&>label]:[align-items:center] [&>label]:[justify-content:center] [&>label]:[min-height:2.75rem] [&>label]:[padding:0.5rem] [&>label]:[border-radius:0.625rem] [&>label]:[color:var(--muted-foreground)] [&>label]:[font-size:0.875rem] [&>label]:[cursor:pointer] [&_input]:[position:absolute] [&_input]:[width:1px] [&_input]:[height:1px] [&_input]:[opacity:0] [&_>_label:has(input:checked)]:[background:var(--card)] [&_>_label:has(input:checked)]:[color:var(--foreground)] [&_>_label:has(input:checked)]:[font-weight:600] [&_>_label:has(input:focus-visible)]:[outline:2px_solid_var(--primary)] [&_>_label:has(input:focus-visible)]:[outline-offset:2px] [&_>_label:has(input:disabled)]:[opacity:0.5] [&_>_label:has(input:disabled)]:[cursor:default]"
        aria-label="Amount type"
      >
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
