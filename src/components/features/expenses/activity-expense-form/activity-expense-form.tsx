"use client";

import { useEffect, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripError } from "@/components/shared/trip-states";
import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import {
  allocatePayment,
  uncovered,
  memberPaymentState,
} from "@/lib/activity-expenses";
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
                  Amount{basis === "per_person" ? " per person" : ""} ·{" "}
                  {currency}
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
                  !!record &&
                  ledger.payments.some((p) => p.expense_id === record.id)
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
            <section
              className="expense-sharing"
              aria-label="Travelers and split"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">Who’s sharing?</h3>
                <span className="text-sm text-muted-foreground">
                  {selected.length}{" "}
                  {selected.length === 1 ? "traveler" : "travelers"}
                </span>
              </div>
              <fieldset className="expense-choice" aria-label="Split costs">
                <legend className="sr-only">Split costs</legend>
                {[
                  { value: "equal", label: "Split evenly" },
                  { value: "exact", label: "Custom amounts" },
                ].map((option) => (
                  <label key={option.value}>
                    <input
                      id={`cost-mode-${option.value}`}
                      type="radio"
                      name="split-mode"
                      checked={mode === option.value}
                      onChange={() => {
                        if (option.value === "exact") {
                          if (previewError) {
                            setValidation(new ApiError(422, previewError));
                            return;
                          }
                          if (basis === "per_person") {
                            setBasis("group");
                            setAmount(moneyInput(total, meta.decimals));
                          }
                          setExact(
                            Object.fromEntries(
                              preview.map((share) => [
                                share.user_id,
                                moneyInput(share.amount_minor, meta.decimals),
                              ]),
                            ),
                          );
                        }
                        setMode(option.value as typeof mode);
                        changed();
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
              <div className="expense-travelers">
                {sharePeople.map((person) => (
                  <div
                    key={person.user_id}
                    className="expense-traveler"
                    data-selected={selected.includes(person.user_id)}
                  >
                    <label className="expense-traveler-name">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={selected.includes(person.user_id)}
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked
                              ? [...ids, person.user_id]
                              : ids.filter((id) => id !== person.user_id),
                          )
                        }
                      />
                      <span className="min-w-0 break-words">
                        {expenseName(person)}
                      </span>
                    </label>
                    {selected.includes(person.user_id) &&
                      (mode === "exact" ? (
                        <Input
                          className="expense-custom-share"
                          aria-label={`Share for ${expenseName(person)}`}
                          inputMode="decimal"
                          value={exact[person.user_id] ?? ""}
                          onChange={(e) =>
                            setExact((values) => ({
                              ...values,
                              [person.user_id]: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <span className="expense-traveler-share">
                          {amount && !previewError
                            ? money(
                                preview.find(
                                  (share) => share.user_id === person.user_id,
                                )?.amount_minor ?? "0",
                              )
                            : "—"}
                        </span>
                      ))}
                  </div>
                ))}
              </div>
              <p className="expense-split-preview" aria-live="polite">
                {amount
                  ? previewError ||
                    `${money(total)} total${mode === "equal" && selected.length && preview[0] && BigInt(total) % BigInt(selected.length) === 0n ? ` · ${money(preview[0].amount_minor)} each` : ""}`
                  : "Add an amount to see everyone’s share."}
              </p>
            </section>
            <details
              className="expense-extra"
              open={record?.planned_coverer_user_id ? true : undefined}
            >
              <summary>
                Plan who pays first{" "}
                <span className="text-muted-foreground font-normal">
                  Optional
                </span>
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
                  <div className="space-y-2">
                    <Label htmlFor="planned-amount">
                      Planned amount · {currency}
                    </Label>
                    <Input
                      id="planned-amount"
                      inputMode="decimal"
                      value={plannedAmount}
                      onChange={(e) => setPlannedAmount(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      A reservation or deposit someone will cover. This stays a
                      plan until a planner/editor confirms the payment.
                    </p>
                  </div>
                )}
              </div>
            </details>
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
          </div>
        )}
        {!isCost && (
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
                  {editor.type === "loan"
                    ? "What is the loan for?"
                    : "Description"}
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
                (!!record &&
                  ledger.payments.some((p) => p.expense_id === record.id))
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
        )}
        {editor.type === "payment" && !editor.memberID && (
          <>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={manual}
                onChange={(e) => {
                  setAllocation(
                    Object.fromEntries(
                      preview.map((s) => [
                        s.user_id,
                        moneyInput(s.amount_minor, meta.decimals),
                      ]),
                    ),
                  );
                  setManual(e.target.checked);
                }}
              />
              Adjust coverage manually
            </label>
            <div className="space-y-2 rounded-xl bg-secondary p-4">
              <p className="font-medium">Payment covers</p>
              {(manual ? paymentRemaining : preview).map((s) => (
                <div
                  key={s.user_id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    {expenseName(people.find((p) => p.user_id === s.user_id))}
                    {s.user_id === payer ? " (own share)" : ""}
                  </span>
                  {manual ? (
                    <Input
                      aria-label={`Coverage for ${expenseName(people.find((p) => p.user_id === s.user_id))}`}
                      className="w-32"
                      inputMode="decimal"
                      value={allocation[s.user_id] ?? "0"}
                      onChange={(e) =>
                        setAllocation((v) => ({
                          ...v,
                          [s.user_id]: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <span>{money(s.amount_minor)}</span>
                  )}
                </div>
              ))}
              <p className="text-sm" aria-live="polite">
                {previewError ||
                  "Included in the original cost. Other travelers reimburse the payer for their covered shares."}
              </p>
            </div>
          </>
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
          <div
            ref={feedback}
            tabIndex={-1}
            className="space-y-2 rounded-xl border p-4"
            role="status"
          >
            <p className="font-medium">Review adjustment before saving</p>
            <p>
              Cost: {money(record.amount_minor)} → {money(total)}
            </p>
            {preview.map((s) => (
              <p key={s.user_id}>
                {expenseName(people.find((p) => p.user_id === s.user_id))}:{" "}
                {money(
                  record.shares.find((old) => old.user_id === s.user_id)
                    ?.amount_minor ?? "0",
                )}{" "}
                → {money(s.amount_minor)}
              </p>
            ))}
            {[
              ...new Set([
                ...record.shares.map((s) => s.user_id),
                ...preview.map((s) => s.user_id),
                ...ledger.payments
                  .filter((p) => p.expense_id === record.id)
                  .flatMap((p) => p.allocations.map((a) => a.user_id)),
              ]),
            ].map((id) => {
              const before = memberPaymentState(record, ledger, id);
              const after = memberPaymentState(
                { ...record, amount_minor: total, shares: preview },
                ledger,
                id,
              );
              return (
                <p key={`balance-${id}`} className="text-sm">
                  {expenseName(people.find((p) => p.user_id === id))}: still to
                  pay {money(before.remaining.toString())} →{" "}
                  {money(after.remaining.toString())}; credit{" "}
                  {money(before.credit.toString())} →{" "}
                  {money(after.credit.toString())}
                </p>
              );
            })}
            <p className="text-sm">
              Recorded payments stay unchanged. Excess coverage becomes a credit
              for review.
            </p>
          </div>
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
