"use client";

import {
  ActivityPicker,
  type PickerActivity,
} from "@/components/features/expenses/activity-picker";
import { ExpenseAmountPanel } from "@/components/features/expenses/expense-amount-panel";

import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { Input } from "@/components/ui/input";
import { ExpenseNumberInput } from "@/components/features/expenses/expense-number-input";
import { Label } from "@/components/ui/label";
import { fieldRequired } from "@/components/shared/field-required";
import {
  expenseName,
  type ActivityLedger,
  type Currency,
  type Expense,
  type ExpensePerson,
} from "@/lib/expenses";

export function TransactionFields({
  editor,
  isCost,
  record,
  ledger,
  activity,
  setActivity,
  pickActivities,
  zone,
  description,
  setDescription,
  currency,
  setCurrency,
  currencies,
  basis,
  amount,
  setAmount,
  date,
  setDate,
  payer,
  setPayer,
  borrower,
  setBorrower,
  currentPeople,
  canChooseLender,
  changed,
}: {
  editor: ExpenseEditor;
  isCost: boolean;
  record?: Expense;
  ledger: ActivityLedger;
  activity: string;
  setActivity: (activity: string) => void;
  activityOptions: { value: string; label: string }[];
  /** Money lent outside an activity: choose one here. */
  pickActivities?: PickerActivity[];
  zone: string;
  description: string;
  setDescription: (description: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  currencies: Currency[];
  basis: "group" | "per_person";
  amount: string;
  setAmount: (amount: string) => void;
  date: string;
  setDate: (date: string) => void;
  payer: number;
  setPayer: (payer: number) => void;
  borrower: number;
  setBorrower: (borrower: number) => void;
  currentPeople: ExpensePerson[];
  canChooseLender: boolean;
  changed: () => void;
}) {
  const currencyField = (
    <ExpenseSelect
      id="cost-currency"
      label="Currency"
      value={currency}
      disabled={
        editor.type === "payment" ||
        editor.type === "repayment" ||
        (!!record && ledger.payments.some((p) => p.expense_id === record.id))
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
  );
  const amountField = (
    <ExpenseAmountPanel
      inputID="cost-amount"
      label={
        editor.type === "loan"
          ? "Amount lent"
          : editor.type === "repayment"
            ? "Amount received"
            : basis === "per_person" && isCost
              ? "Amount per person"
              : "Amount paid"
      }
      currency={currencyField}
      footer={
        editor.type === "loan"
          ? "Loans never add to activity spending"
          : undefined
      }
    >
      <ExpenseNumberInput
        id="cost-amount"
        required
        placeholder={(0).toFixed(
          currencies.find((c) => c.code === currency)?.decimals ?? 2,
        )}
        inputMode="decimal"
        readOnly={
          !!editor.receipt &&
          !editor.receipt.payment_id &&
          !editor.receipt.loan_id
        }
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
    </ExpenseAmountPanel>
  );
  const dateField = (
    <div className="space-y-2">
      <Label htmlFor="cost-date">
        {isCost
          ? "Cost date"
          : editor.type === "loan"
            ? "Date lent"
            : "Date paid"}
      </Label>
      <Input
        id="cost-date"
        required
        type="date"
        min="0001-01-01"
        max="9999-12-31"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
    </div>
  );
  const payerField = (
    <ExpenseSelect
      id="cost-payer"
      label={editor.type === "loan" ? "Lent by" : "Paid by"}
      value={String(payer)}
      options={currentPeople.map((p) => ({
        value: String(p.user_id),
        label: expenseName(p),
      }))}
      onChange={(v) => {
        setPayer(Number(v));
        changed();
      }}
      disabled={
        !!editor.memberID ||
        !!editor.payment ||
        (editor.type === "loan" && !canChooseLender)
      }
    />
  );

  if (editor.type === "loan") {
    return (
      // Figma: borrower, purpose, the amount, then the date.
      <div className="space-y-5 [&_[data-slot=input]]:min-h-12 [&_[data-slot=select-trigger]]:min-h-12 [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:break-all [&_[data-slot=select-value]]:line-clamp-none">
        <div className="space-y-5">
          {canChooseLender && !editor.memberID && !editor.payment && payerField}
          <ExpenseSelect
            id="loan-borrower"
            required
            label="Who borrowed the money?"
            value={String(borrower)}
            options={[
              { value: "0", label: "Choose a borrower" },
              ...currentPeople
                .filter((p) => p.user_id !== payer)
                .map((p) => ({
                  value: String(p.user_id),
                  label: expenseName(p),
                })),
            ]}
            onChange={(v) => {
              setBorrower(Number(v));
              changed();
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost-description" className={fieldRequired}>
            What is the loan for?
          </Label>
          <Input
            id="cost-description"
            required
            maxLength={200}
            placeholder="e.g. Lunch and boat tickets"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {amountField}
        {pickActivities && (
          <ActivityPicker
            id="loan-activity"
            required
            activities={pickActivities}
            zone={zone}
            value={Number(activity)}
            onChange={(value) => {
              setActivity(value ? String(value) : "");
              changed();
            }}
          />
        )}
        {dateField}
      </div>
    );
  }

  return (
    <>
      {amountField}
      {dateField}
      {editor.type === "payment" && payerField}
    </>
  );
}
