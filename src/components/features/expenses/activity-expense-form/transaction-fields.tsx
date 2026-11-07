"use client";

import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  activityOptions,
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
  return (
    <>
      {editor.type === "loan" && (
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
      {editor.type === "loan" && (
        <div className="space-y-2">
          <Label htmlFor="cost-description">
            {editor.type === "loan" ? "What is the loan for?" : "Description"}
          </Label>
          <Input
            id="cost-description"
            required
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
          />
        </div>
      )}
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
      <div className="space-y-2">
        <Label htmlFor="cost-amount">
          Amount{basis === "per_person" && isCost ? " per person" : ""} ·{" "}
          {currency}
        </Label>
        <Input
          id="cost-amount"
          required
          inputMode="decimal"
          readOnly={
            !!editor.receipt &&
            !editor.receipt.payment_id &&
            !editor.receipt.loan_id
          }
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
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
      {(editor.type === "payment" || editor.type === "loan") && (
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
      )}
      {editor.type === "loan" && (
        <>
          <ExpenseSelect
            id="loan-borrower"
            label="Borrowed by"
            value={String(borrower)}
            options={currentPeople
              .filter((p) => p.user_id !== payer)
              .map((p) => ({
                value: String(p.user_id),
                label: expenseName(p),
              }))}
            onChange={(v) => {
              setBorrower(Number(v));
              changed();
            }}
          />
          <p className="text-sm text-muted-foreground">
            A cash loan creates a debt. It does not add activity spending.
          </p>
        </>
      )}
    </>
  );
}
