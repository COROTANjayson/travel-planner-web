"use client";

import { AdjustmentReview } from "@/components/features/expenses/activity-expense-form/adjustment-review";
import { CostDateDetails } from "@/components/features/expenses/activity-expense-form/cost-date-details";
import { CostFields } from "@/components/features/expenses/activity-expense-form/cost-fields";
import { PaymentCoverage } from "@/components/features/expenses/activity-expense-form/payment-coverage";
import { PlannedCoverer } from "@/components/features/expenses/activity-expense-form/planned-coverer";
import { SharingSection } from "@/components/features/expenses/activity-expense-form/sharing-section";
import { TransactionFields } from "@/components/features/expenses/activity-expense-form/transaction-fields";

import { useEffect, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripError } from "@/components/shared/trip-states";
import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { allocatePayment, uncovered } from "@/lib/activity-expenses";
import {
  equalShares,
  formatMoney,
  maxMinor,
  moneyInput,
  parseMoney,
} from "@/lib/money";
import {
  expenseName,
  type ActivityLedger,
  type Currency,
  type Debt,
  type Expense,
  type ExpenseInput,
  type ExpensePerson,
  type TransactionInput,
  type Settlement,
} from "@/lib/expenses";

export type ExpenseEditor = {
  type: "cost" | "cover" | "payment" | "loan" | "repayment";
  cost?: Expense;
  debt?: Debt;
  receipt?: Settlement;
  memberID?: number;
  payment?: import("@/lib/expenses").BusinessPayment;
};
export function ActivityExpenseForm({
  editor,
  activityID,
  activities,
  people,
  currencies,
  userID,
  zone,
  ledger,
  pending,
  error,
  onDirty,
  onSave,
  onCancel,
  canChooseLender = false,
  currentUserIDs = people.map((p) => p.user_id),
}: {
  editor: ExpenseEditor;
  activityID: string;
  activities: { id: number; title: string }[];
  people: ExpensePerson[];
  currencies: Currency[];
  userID: number;
  zone: string;
  ledger: ActivityLedger;
  currentUserIDs?: number[];
  canChooseLender?: boolean;
  pending: boolean;
  error: Error | null;
  onDirty: () => void;
  onSave: (input: ExpenseInput | TransactionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const isCost = editor.type === "cost" || editor.type === "cover";
  const record = editor.cost;
  const currentPeople = people.filter((p) =>
    currentUserIDs.includes(p.user_id),
  );
  const sharePeople = people.filter(
    (p) =>
      currentUserIDs.includes(p.user_id) ||
      record?.shares.some((s) => s.user_id === p.user_id),
  );
  const debtOptions = ledger.debts.filter(
    (d) =>
      editor.receipt &&
      d.from_user_id === editor.receipt.from_user_id &&
      d.to_user_id === editor.receipt.to_user_id &&
      d.currency === editor.receipt.currency &&
      BigInt(d.amount_minor) >= BigInt(editor.receipt.amount_minor),
  );
  const debtID = (d: Debt) =>
    d.payment_id ? `payment:${d.payment_id}` : `loan:${d.loan_id}`;
  const [selectedDebt, setSelectedDebt] = useState(
    debtOptions[0] ? debtID(debtOptions[0]) : "",
  );
  const debt = editor.debt
    ? (ledger.debts.find(
        (d) =>
          d.payment_id === editor.debt!.payment_id &&
          d.loan_id === editor.debt!.loan_id &&
          d.from_user_id === editor.debt!.from_user_id &&
          d.to_user_id === editor.debt!.to_user_id,
      ) ?? editor.debt)
    : debtOptions.find((d) => debtID(d) === selectedDebt);
  const [activity, setActivity] = useState(
    String(
      record
        ? record.activity_id || (record.activity_name ? "0" : "")
        : Number(activityID) > 0
          ? activityID
          : "",
    ),
  );
  const [description, setDescription] = useState(record?.description ?? "");
  const [currency, setCurrency] = useState(
    editor.receipt?.currency ?? debt?.currency ?? record?.currency ?? "PHP",
  );
  const meta = currencies.find((c) => c.code === currency)!;
  const [basis, setBasis] = useState(record?.amount_basis ?? "group");
  const [plannedCoverer, setPlannedCoverer] = useState(
    record?.planned_coverer_user_id ?? 0,
  );
  const [plannedAmount, setPlannedAmount] = useState(
    record?.planned_cover_amount_minor
      ? moneyInput(record.planned_cover_amount_minor, meta.decimals)
      : "",
  );
  const [correctionReason, setCorrectionReason] = useState("");
  const [amount, setAmount] = useState(
    record && isCost
      ? moneyInput(
          (basis === "per_person"
            ? BigInt(record.amount_minor) / BigInt(record.shares.length)
            : BigInt(record.amount_minor)
          ).toString(),
          meta.decimals,
        )
      : editor.receipt || debt
        ? moneyInput((editor.receipt ?? debt)!.amount_minor, meta.decimals)
        : editor.type === "payment" && record
          ? moneyInput(
              editor.payment?.amount_minor ??
                (editor.memberID
                  ? (uncovered(record, ledger).find(
                      (s) => s.user_id === editor.memberID,
                    )?.amount_minor ?? "0")
                  : (record.planned_cover_amount_minor ?? "0")),
              meta.decimals,
            )
          : "",
  );
  const [date, setDate] = useState(
    editor.payment
      ? editor.payment.paid_on
      : editor.receipt
        ? editor.receipt.paid_on
        : isCost && record
          ? record.incurred_on
          : Temporal.Now.zonedDateTimeISO(zone).toPlainDate().toString(),
  );
  const [payer, setPayer] = useState(
    editor.payment?.payer_user_id ??
      editor.memberID ??
      record?.planned_coverer_user_id ??
      userID,
  );
  const [borrower, setBorrower] = useState(
    currentPeople.find((p) => p.user_id !== userID)?.user_id ?? 0,
  );
  const [selected, setSelected] = useState(
    record?.shares.map((s) => s.user_id) ??
      (editor.type === "cover" ? [] : currentPeople.map((p) => p.user_id)),
  );
  const [mode, setMode] = useState(record?.split_mode ?? "equal");
  const [exact, setExact] = useState<Record<number, string>>(
    Object.fromEntries(
      record?.shares.map((s) => [
        s.user_id,
        moneyInput(s.amount_minor, meta.decimals),
      ]) ?? [],
    ),
  );
  const [manual, setManual] = useState(!!editor.payment);
  const [allocation, setAllocation] = useState<Record<number, string>>(
    Object.fromEntries(
      editor.payment?.allocations.map((s) => [
        s.user_id,
        moneyInput(s.amount_minor, meta.decimals),
      ]) ?? [],
    ),
  );
  const [validation, setValidation] = useState<Error | null>(null);
  const [review, setReview] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (validation || error || review) feedback.current?.focus();
  }, [validation, error, review]);
  const money = (v: string) => formatMoney(v, meta);
  let preview: { user_id: number; amount_minor: string }[] = [];
  let total = "0",
    previewError = "";
  try {
    total = parseMoney(amount, meta.decimals);
    if (BigInt(total) <= 0n) throw new Error("Enter a positive amount.");
    if (isCost) {
      if (!selected.length) throw new Error("Choose at least one traveler.");
      if (basis === "per_person") {
        total = (BigInt(total) * BigInt(selected.length)).toString();
        if (BigInt(total) > maxMinor)
          throw new Error("This total is too large.");
      }
      preview =
        mode === "equal"
          ? equalShares(total, selected)
          : selected.map((user_id) => ({
              user_id,
              amount_minor: parseMoney(exact[user_id] ?? "", meta.decimals),
            }));
      if (
        preview.reduce((n, s) => n + BigInt(s.amount_minor), 0n) !==
        BigInt(total)
      )
        throw new Error("Custom shares must equal the total.");
    } else if (editor.type === "payment" && record) {
      const paid = ledger.payments
        .filter(
          (p) => p.expense_id === record.id && p.id !== editor.payment?.id,
        )
        .reduce((n, p) => n + BigInt(p.amount_minor), 0n);
      if (BigInt(total) > BigInt(record.amount_minor) - paid)
        throw new Error("Payment exceeds the remaining business amount.");
      const remaining = uncovered(record, {
        ...ledger,
        payments: ledger.payments.filter((p) => p.id !== editor.payment?.id),
      });
      preview = manual
        ? remaining.map((s) => ({
            user_id: s.user_id,
            amount_minor: parseMoney(
              allocation[s.user_id] || "0",
              meta.decimals,
            ),
          }))
        : editor.memberID
          ? [{ user_id: editor.memberID, amount_minor: total }]
          : allocatePayment(total, payer, remaining);
      if (
        preview.reduce((n, s) => n + BigInt(s.amount_minor), 0n) !==
        BigInt(total)
      )
        throw new Error("Coverage amounts must equal the payment.");
      if (
        preview.some(
          (s) =>
            BigInt(s.amount_minor) >
            (BigInt(
              remaining.find((r) => r.user_id === s.user_id)?.amount_minor ??
                "0",
            ) > 0n
              ? BigInt(
                  remaining.find((r) => r.user_id === s.user_id)
                    ?.amount_minor ?? "0",
                )
              : 0n),
        )
      )
        throw new Error("Coverage cannot exceed a traveler's uncovered share.");
    }
  } catch (cause) {
    previewError = (cause as Error).message;
  }
  const activityOptions = activities.map((a) => ({
    value: String(a.id),
    label: a.title,
  }));
  if (record && !record.activity_id && record.activity_name)
    activityOptions.push({
      value: "0",
      label: `${record.activity_name} (removed)`,
    });
  const paymentRemaining = record
    ? uncovered(record, {
        ...ledger,
        payments: ledger.payments.filter((p) => p.id !== editor.payment?.id),
      })
    : [];
  const changed = () => {
    onDirty();
    setReview(false);
  };
  return (
    <form
      className={`ledger-form space-y-5${isCost ? " expense-cost-form" : ""}`}
      onChange={changed}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        try {
          if (previewError) throw new Error(previewError);
          if (
            isCost &&
            plannedCoverer &&
            (BigInt(parseMoney(plannedAmount, meta.decimals)) <= 0n ||
              BigInt(parseMoney(plannedAmount, meta.decimals)) > BigInt(total))
          )
            throw new Error(
              "Planned coverage must be positive and within this cost.",
            );
          if (editor.receipt && !correctionReason.trim())
            throw new Error("Explain the receipt correction.");
          if (editor.type === "repayment" && !debt)
            throw new Error("Choose an outstanding debt for this receipt.");
          if ((isCost || editor.type === "loan") && !activity)
            throw new Error("Choose an activity first.");
          if (editor.type === "loan" && (!borrower || borrower === payer))
            throw new Error("Choose a different borrower.");
          if (editor.type === "loan" && !currentUserIDs.includes(borrower))
            throw new Error("Choose a current trip participant.");
          if (
            editor.type === "repayment" &&
            debt &&
            !editor.receipt &&
            BigInt(total) > BigInt(debt.amount_minor)
          )
            throw new Error("Enter an amount within the outstanding balance.");
        } catch (cause) {
          // TripError only shows ApiError text; these messages are written for the user.
          setValidation(new ApiError(422, (cause as Error).message));
          return;
        }
        try {
          setValidation(null);
          if (
            isCost &&
            record &&
            ledger.payments.some((p) => p.expense_id === record.id) &&
            !review
          ) {
            setReview(true);
            return;
          }
          if (isCost)
            await onSave({
              activity_id: Number(activity),
              description,
              planned_coverer_user_id: plannedCoverer,
              planned_cover_amount_minor: plannedCoverer
                ? parseMoney(plannedAmount, meta.decimals)
                : "",
              currency,
              amount_minor: total,
              amount_basis: basis,
              incurred_on: date,
              payer_user_id: editor.type === "cover" ? userID : 0,
              split_mode: mode,
              shares:
                mode === "equal"
                  ? selected.map((user_id) => ({ user_id }))
                  : preview,
              ...(record ? { version: record.version } : {}),
            });
          else
            await onSave({
              ...(editor.type === "repayment"
                ? { correction_reason: correctionReason }
                : {}),
              ...(editor.payment ? { version: editor.payment.version } : {}),
              activity_id: Number(activity),
              expense_id: record?.id,
              description,
              currency,
              amount_minor: total,
              paid_on: date,
              payer_user_id: payer,
              from_user_id: payer,
              to_user_id: borrower,
              ...(editor.type === "repayment" && debt
                ? {
                    payment_id: debt.payment_id,
                    loan_id: debt.loan_id,
                    from_user_id: debt.from_user_id,
                    to_user_id: debt.to_user_id,
                  }
                : {}),
              ...(editor.type === "payment" ? { allocations: preview } : {}),
            });
        } catch (cause) {
          setValidation(
            cause instanceof Error
              ? cause
              : new ApiError(500, "Unable to save. Retry this draft."),
          );
        }
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        {editor.receipt &&
          !editor.receipt.payment_id &&
          !editor.receipt.loan_id && (
            <>
              <p className="text-sm text-muted-foreground">
                Assign this existing receipt to a debt. No new money movement
                will be recorded.
              </p>
              <ExpenseSelect
                id="receipt-source"
                label="Debt this receipt paid"
                value={selectedDebt}
                options={debtOptions.map((d) => ({
                  value: debtID(d),
                  label: `${d.description} · ${money(d.amount_minor)}`,
                }))}
                onChange={(v) => {
                  setSelectedDebt(v);
                  changed();
                }}
              />
            </>
          )}
        {isCost && (
          <div className="expense-cost-content">
            <CostFields
              description={description}
              setDescription={setDescription}
              activity={activity}
              setActivity={setActivity}
              activityOptions={activityOptions}
              basis={basis}
              setBasis={setBasis}
              setMode={setMode}
              amount={amount}
              setAmount={setAmount}
              currency={currency}
              setCurrency={setCurrency}
              currencies={currencies}
              record={record}
              ledger={ledger}
              changed={changed}
            />
            <SharingSection
              sharePeople={sharePeople}
              selected={selected}
              setSelected={setSelected}
              mode={mode}
              setMode={setMode}
              basis={basis}
              setBasis={setBasis}
              amount={amount}
              setAmount={setAmount}
              exact={exact}
              setExact={setExact}
              preview={preview}
              previewError={previewError}
              total={total}
              meta={meta}
              money={money}
              setValidation={setValidation}
              changed={changed}
            />
            <PlannedCoverer
              record={record}
              people={people}
              currentUserIDs={currentUserIDs}
              plannedCoverer={plannedCoverer}
              setPlannedCoverer={setPlannedCoverer}
              plannedAmount={plannedAmount}
              setPlannedAmount={setPlannedAmount}
              currency={currency}
              changed={changed}
            />
            <CostDateDetails
              date={date}
              setDate={setDate}
              activity={activity}
              setActivity={setActivity}
              activityOptions={activityOptions}
              changed={changed}
            />
          </div>
        )}
        {!isCost && (
          <TransactionFields
            editor={editor}
            isCost={isCost}
            record={record}
            ledger={ledger}
            activity={activity}
            setActivity={setActivity}
            activityOptions={activityOptions}
            description={description}
            setDescription={setDescription}
            currency={currency}
            setCurrency={setCurrency}
            currencies={currencies}
            basis={basis}
            amount={amount}
            setAmount={setAmount}
            date={date}
            setDate={setDate}
            payer={payer}
            setPayer={setPayer}
            borrower={borrower}
            setBorrower={setBorrower}
            currentPeople={currentPeople}
            canChooseLender={canChooseLender}
            changed={changed}
          />
        )}
        {editor.type === "payment" && !editor.memberID && (
          <PaymentCoverage
            manual={manual}
            setManual={setManual}
            allocation={allocation}
            setAllocation={setAllocation}
            preview={preview}
            previewError={previewError}
            paymentRemaining={paymentRemaining}
            people={people}
            payer={payer}
            meta={meta}
            money={money}
          />
        )}
        {editor.type === "repayment" && debt && (
          <p className="rounded-xl bg-secondary p-4">
            {expenseName(people.find((p) => p.user_id === debt.from_user_id))} →{" "}
            {expenseName(people.find((p) => p.user_id === debt.to_user_id))}
            <br />
            {debt.description} · Outstanding {money(debt.amount_minor)}
            <br />
            Record only money you have received outside the app.
          </p>
        )}
        {review && record && (
          <AdjustmentReview
            feedback={feedback}
            record={record}
            total={total}
            preview={preview}
            ledger={ledger}
            people={people}
            money={money}
          />
        )}
        {editor.receipt && (
          <div className="space-y-2">
            <Label htmlFor="receipt-reason">Reason for correction</Label>
            <Input
              id="receipt-reason"
              required
              maxLength={500}
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
            />
          </div>
        )}
        {editor.type === "payment" && (
          <p className="text-sm text-muted-foreground">
            Only a planner/editor can confirm a payment to the business.
          </p>
        )}
        {editor.type === "repayment" && !editor.receipt && (
          <p className="text-sm text-muted-foreground">
            Only the recipient can confirm this money was received.
          </p>
        )}
        {(validation || error) && (
          <div ref={feedback} tabIndex={-1}>
            <TripError error={validation ?? error!} />
          </div>
        )}
        <div className="sticky bottom-0 -mx-6 flex flex-wrap justify-end gap-2 border-t bg-card px-6 py-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {pending
              ? "Saving…"
              : review
                ? "Confirm adjustment"
                : editor.receipt
                  ? "Save correction"
                  : editor.type === "repayment"
                    ? "Mark as paid"
                    : editor.type === "payment"
                      ? "Confirm payment"
                      : editor.type === "loan"
                        ? "Record money lent"
                        : "Save expense"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
