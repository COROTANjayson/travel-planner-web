"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldRequired } from "@/components/shared/field-required";
import { OptionsMenu } from "@/components/shared/options-menu";
import { TripDialog } from "@/components/shared/trip-dialog";
import { expenseModalProps } from "@/components/shared/trip-dialog-variants";
import { TripError } from "@/components/shared/trip-states";
import { ExpenseAmountPanel } from "@/components/features/expenses/expense-amount-panel";
import { PaymentCoverage } from "@/components/features/expenses/activity-expense-form/payment-coverage";
import {
  allocatePayment,
  checkCoverage,
  uncovered,
} from "@/lib/activity-expenses";
import {
  ExpenseDateField,
  ExpensePriceField,
} from "@/components/features/expenses/expense-fields";
import { expenseMoney, moneyInput, parseMoney } from "@/lib/money";
import {
  expenseName,
  useExpensesApi,
  type Debt,
  type PaymentStatus,
  type Share,
} from "@/lib/expenses";
import { rowDetail, rowTitle } from "@/components/features/expenses/card-row";
import type { Context } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import {
  memberRecords,
  paidOnLabel,
  type Recorded,
} from "@/components/features/expenses/drawers/payment-workspace/payment-history";

// What the member still owes, one row per payee.
type Owed =
  | { key: "business"; amount: string }
  | { key: string; amount: string; debt: Debt };
// The one row being worked on: recording a payment, changing or undoing one.
type Active =
  | { type: "pay"; key: string }
  | { type: "change"; item: Recorded }
  | { type: "undo"; item: Recorded };

/**
 * A member's payment modal, opened straight from the payments table. It shows
 * progress, one "To pay" row per payee with its own action, and the payments
 * already recorded (Change/Undo under ⋯). Recording happens inline on the row:
 * the full amount and today are filled in, so most payments take two taps.
 */
export function MemberPaymentModal(
  props: Context & { status: PaymentStatus; user: number; onClose: () => void },
) {
  const { trip, cost, status, user, current, onClose } = props;
  const api = useExpensesApi(trip.id, props.onFailure);
  const formID = useId();
  // A failed response may already have committed, so a retry keeps its key.
  const key = useRef("");
  const today = Temporal.Now.zonedDateTimeISO(trip.time_zone)
    .toPlainDate()
    .toString();
  const member = status.members.find((m) => m.user_id === user);
  const editor = current?.role === "owner" || current?.role === "editor";
  const directBusiness =
    editor &&
    !!props.participants?.some((p) => p.user_id === user) &&
    !!member &&
    BigInt(member.business_remaining_minor) > 0n &&
    !member.reimbursements.some((d) => BigInt(d.amount_minor) > 0n);
  const [active, setActive] = useState<Active | null>(() =>
    directBusiness ? { type: "pay", key: "business" } : null,
  );
  const [amount, setAmount] = useState(() =>
    directBusiness
      ? moneyInput(member.business_remaining_minor, props.currency.decimals)
      : "",
  );
  const [date, setDate] = useState(today);
  const [editDate, setEditDate] = useState(false);
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState<Error | null>(null);
  const [manual, setManual] = useState(true);
  const [allocation, setAllocation] = useState<Record<number, string>>({});
  const writable = !!current && current.role !== "viewer";
  const money = (value: string | bigint) =>
    expenseMoney(String(value), props.currency);
  const name = (id: number) =>
    expenseName(
      props.participants?.find((p) => p.user_id === id) ??
        status.people.find((p) => p.user_id === id),
    );
  const owed: Owed[] = member
    ? [
        ...(BigInt(member.business_remaining_minor) > 0n
          ? [
              {
                key: "business" as const,
                amount: member.business_remaining_minor,
              },
            ]
          : []),
        ...member.reimbursements
          .filter((d) => BigInt(d.amount_minor) > 0n)
          .map((debt) => ({
            key: `${debt.payment_id}:${debt.to_user_id}`,
            amount: debt.amount_minor,
            debt,
          })),
      ]
    : [];
  // Business payments are recorded by editors; a reimbursement only by the
  // person who received it.
  const canPay = (row: Owed) =>
    "debt" in row
      ? writable && current?.user_id === row.debt.to_user_id
      : editor && !!props.participants?.some((p) => p.user_id === user);
  const records = memberRecords(status, user);
  const canEdit = (item: Recorded) =>
    writable &&
    (editor ||
      (item.kind === "settlements" &&
        current?.user_id === item.record.to_user_id));
  const linked = (item: Recorded) =>
    item.kind === "expense_payments" &&
    status.receipts.some((s) => s.payment_id === item.record.id);

  function start(next: Active, prefill?: string, paidOn = today) {
    key.current = "";
    api.reset();
    setFailure(null);
    setReason("");
    setEditDate(false);
    setManual(true);
    setAllocation(
      next.type === "change" && next.item.kind === "expense_payments"
        ? Object.fromEntries(
            next.item.record.allocations.map((s) => [
              s.user_id,
              moneyInput(s.amount_minor, props.currency.decimals),
            ]),
          )
        : {},
    );
    setAmount(prefill ? moneyInput(prefill, props.currency.decimals) : "");
    setDate(paidOn);
    setActive(next);
  }
  function cancel() {
    if (api.pending) return;
    setActive(null);
    setFailure(null);
  }
  const needsReason =
    (active?.type === "change" || active?.type === "undo") &&
    active.item.kind === "settlements";
  const activeRow =
    active?.type === "pay" ? owed.find((o) => o.key === active.key) : undefined;
  let minor = "";
  let problem = "";
  if (active && active.type !== "undo")
    try {
      minor = parseMoney(amount, props.currency.decimals);
      if (BigInt(minor) <= 0n) throw new Error("Enter a positive amount.");
      if (activeRow && BigInt(minor) > BigInt(activeRow.amount))
        throw new Error(`Enter at most ${money(activeRow.amount)}.`);
    } catch (cause) {
      problem = (cause as Error).message;
    }
  // The API requires a reason to change or undo a reimbursement receipt.
  const reasonMissing = needsReason && !reason.trim();
  const changingPayment =
    active?.type === "change" && active.item.kind === "expense_payments"
      ? active.item.record
      : undefined;
  const paymentRemaining = changingPayment
    ? uncovered(status.expense, {
        expenses: [status.expense],
        payments: status.payments.filter((p) => p.id !== changingPayment.id),
        settlements: status.receipts,
        people: status.people,
        loans: [],
        debts: [],
      })
    : [];
  let coverage: Share[] = [];
  let coverageProblem = "";
  if (changingPayment && !problem)
    try {
      coverage = manual
        ? paymentRemaining.map((s) => ({
            user_id: s.user_id,
            amount_minor: parseMoney(
              allocation[s.user_id] || "0",
              props.currency.decimals,
            ),
          }))
        : allocatePayment(
            minor,
            changingPayment.payer_user_id,
            paymentRemaining,
          );
      coverage = coverage.filter((s) => BigInt(s.amount_minor) > 0n);
      checkCoverage(coverage, paymentRemaining, minor);
    } catch (cause) {
      coverageProblem = (cause as Error).message;
    }

  async function confirm() {
    if (!active || api.pending || problem || coverageProblem || reasonMissing)
      return;
    if (!key.current) key.current = crypto.randomUUID();
    setFailure(null);
    try {
      if (active.type === "undo") {
        await api.remove(
          active.item.kind,
          active.item.record,
          needsReason ? reason.trim() : undefined,
        );
      } else if (active.type === "change") {
        if (active.item.kind === "expense_payments") {
          const p = active.item.record;
          await api.saveTransaction(
            "expense_payments",
            {
              expense_id: cost.id,
              currency: cost.currency,
              amount_minor: minor,
              paid_on: date,
              payer_user_id: p.payer_user_id,
              allocations: coverage,
              version: p.version,
            },
            p,
            key.current,
          );
        } else {
          const s = active.item.record;
          await api.saveSettlement(
            {
              ...s,
              amount_minor: minor,
              paid_on: date,
              correction_reason: reason.trim(),
            },
            s,
            key.current,
          );
        }
      } else if (activeRow) {
        if ("debt" in activeRow)
          await api.saveSettlement(
            {
              payment_id: activeRow.debt.payment_id,
              from_user_id: user,
              to_user_id: activeRow.debt.to_user_id,
              currency: cost.currency,
              amount_minor: minor,
              paid_on: date,
            },
            undefined,
            key.current,
          );
        else
          await api.saveTransaction(
            "expense_payments",
            {
              expense_id: cost.id,
              currency: cost.currency,
              amount_minor: minor,
              paid_on: date,
              payer_user_id: user,
              member_user_id: user,
            },
            undefined,
            key.current,
          );
      }
      // The workspace refreshes and reopens this modal on the new state.
    } catch (cause) {
      setFailure(cause as Error);
    }
  }

  // Entering a payment focuses (and selects) the big amount in the card.
  useEffect(() => {
    if (active && active.type !== "undo")
      document.getElementById(`${formID}-amount`)?.focus();
  }, [active, formID]);
  useEffect(() => {
    if (!member) onClose();
  }, [member, onClose]);
  if (!member) return null;

  const paid = BigInt(member.paid_minor);
  const share = BigInt(member.share_minor);
  const done = BigInt(member.remaining_minor) <= 0n;
  const percent = share > 0n ? Number((paid * 100n) / share) : 0;
  const payee = (row: Owed) =>
    "debt" in row ? name(row.debt.to_user_id) : cost.description;
  const itemPayee = (item: Recorded) =>
    item.kind === "expense_payments"
      ? cost.description
      : name(item.record.to_user_id);
  const big =
    "text-[36px] leading-[43px] font-semibold tracking-tight tabular-nums sm:text-5xl sm:leading-[60px]";
  const cardLabel = activeRow
    ? `To ${payee(activeRow)}`
    : active && active.type !== "pay"
      ? `${active.type === "undo" ? "Undo" : "Change"} · to ${itemPayee(active.item)}`
      : "";

  // The ocean card: what's left at rest, the amount being entered while a
  // payment is recorded or changed, and the payment being undone.
  const card = !active ? (
    <div
      aria-live="polite"
      className="grid gap-3 rounded-[16px] bg-[var(--ocean)] p-5 text-[var(--ocean-text)]"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {done && (
          <CheckCircleIcon
            aria-hidden="true"
            weight="fill"
            className="size-5 text-[var(--aqua)]"
          />
        )}
        {done ? "Paid in full" : "Left to pay"}
      </p>
      <p className={`${big} text-white`}>
        {money(done ? member.share_minor : member.remaining_minor)}
      </p>
      <div
        role="progressbar"
        aria-label="Share paid"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-[var(--ocean-raised)]"
      >
        <div
          className="h-full rounded-full bg-[var(--aqua)] transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm tabular-nums">
        {money(member.paid_minor)} of {money(member.share_minor)} paid
      </p>
    </div>
  ) : active.type === "undo" ? (
    <div className="grid gap-2 rounded-[16px] bg-[var(--ocean)] p-5 text-[var(--ocean-text)]">
      <p className="text-sm font-medium">{cardLabel}</p>
      <p
        className={`${big} text-white line-through decoration-[var(--aqua)] decoration-2`}
      >
        {money(active.item.record.amount_minor)}
      </p>
      <p className="text-sm">
        Paid {paidOnLabel(active.item.record.paid_on)}. Balances update right
        away.
      </p>
    </div>
  ) : (
    <ExpenseAmountPanel
      inputID={`${formID}-amount`}
      label={cardLabel}
      currency={cost.currency}
      footer={
        <div className="grid justify-items-center gap-1">
          {editDate ? (
            <ExpenseDateField
              id={`${formID}-date`}
              aria-label="Date paid"
              min="0001-01-01"
              max="9999-12-31"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          ) : (
            <Button
              type="button"
              variant="link"
              className="-my-2 min-h-11 px-0 font-normal text-[var(--ocean-text)] hover:text-white"
              aria-label={`Date paid: ${date === today ? "Today" : paidOnLabel(date)}. Change date`}
              onClick={() => setEditDate(true)}
            >
              Paid {date === today ? "today" : paidOnLabel(date)} · change
            </Button>
          )}
          {problem && amount !== "" && (
            <p role="alert" className="text-[#ffd5ca]">
              {problem}
            </p>
          )}
        </div>
      }
    >
      <ExpensePriceField
        currency={props.currency}
        id={`${formID}-amount`}
        required
        value={amount}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setAmount(e.target.value);
          setFailure(null);
          api.reset();
        }}
      />
    </ExpenseAmountPanel>
  );

  const footer = active ? (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={api.pending}
        onClick={cancel}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form={formID}
        variant={active.type === "undo" ? "destructive" : "default"}
        disabled={
          api.pending || !!problem || !!coverageProblem || reasonMissing
        }
      >
        {api.pending
          ? "Saving…"
          : active.type === "undo"
            ? "Undo payment"
            : active.type === "change"
              ? "Save change"
              : `Confirm ${minor && !problem ? money(minor) : ""}`.trim()}
      </Button>
    </>
  ) : (
    <Button type="button" onClick={onClose}>
      Done
    </Button>
  );

  return (
    <TripDialog
      open
      finalFocus={props.finalFocus}
      {...expenseModalProps}
      initialFocus={
        directBusiness
          ? () => document.getElementById(`${formID}-amount`)
          : undefined
      }
      title={`${name(user)}’s payment`}
      description={`${cost.description} · share ${money(member.share_minor)}`}
      busy={api.pending}
      onOpenChange={(open) => {
        if (open) return;
        if (active) cancel();
        else onClose();
      }}
      footer={
        <div className="flex gap-3 sm:justify-end max-sm:[&>*]:flex-1 [&>[data-slot=button]]:justify-center!">
          {footer}
        </div>
      }
    >
      <form
        id={formID}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void confirm();
        }}
      >
        <fieldset disabled={api.pending} className="grid min-w-0 gap-5">
          {card}
          {changingPayment && (
            <PaymentCoverage
              manual={manual}
              setManual={setManual}
              allocation={allocation}
              setAllocation={setAllocation}
              preview={coverage}
              previewError={coverageProblem || problem}
              paymentRemaining={paymentRemaining}
              people={props.participants ?? status.people}
              payer={changingPayment.payer_user_id}
              meta={props.currency}
              money={money}
            />
          )}
          {needsReason && (
            <div className="space-y-2">
              <Label htmlFor={`${formID}-reason`} className={fieldRequired}>
                Reason
              </Label>
              <Input
                id={`${formID}-reason`}
                required
                maxLength={500}
                placeholder="e.g. Entered twice"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          {(failure || api.error) && (
            <TripError error={failure ?? api.error!} />
          )}
          {owed.length > 0 && (
            <ul
              aria-label="To pay"
              className="divide-y overflow-hidden rounded-[16px] border bg-card"
            >
              {owed.map((row) => {
                const debt = "debt" in row ? row.debt : undefined;
                const selected =
                  active?.type === "pay" && active.key === row.key;
                return (
                  <li
                    key={row.key}
                    aria-current={selected || undefined}
                    className="flex items-center gap-3 px-3.5 py-3 [overflow-wrap:anywhere] aria-[current]:bg-secondary sm:px-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={rowTitle}>{payee(row)}</p>
                      {debt && (
                        <p className={rowDetail}>
                          {canPay(row)
                            ? "Reservation"
                            : `Reservation · ${name(debt.to_user_id)} confirms`}
                        </p>
                      )}
                    </div>
                    <p className={`shrink-0 tabular-nums ${rowTitle}`}>
                      {money(row.amount)}
                    </p>
                    {canPay(row) && (
                      <Button
                        type="button"
                        variant={selected ? "default" : "outline"}
                        className="min-h-10 shrink-0 px-3"
                        disabled={api.pending || (!!active && !selected)}
                        aria-pressed={selected}
                        aria-label={`${debt ? "Mark received" : "Mark paid"}: ${money(row.amount)} to ${payee(row)}`}
                        onClick={() =>
                          selected
                            ? cancel()
                            : start({ type: "pay", key: row.key }, row.amount)
                        }
                      >
                        {debt ? "Received" : "Mark paid"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {records.length > 0 && (
            <section aria-label="Paid" className="space-y-2">
              <h3 className={rowTitle}>Paid</h3>
              <ul className="divide-y overflow-hidden rounded-[16px] border bg-card">
                {records.map((item) => {
                  const locked = linked(item);
                  const selected =
                    (active?.type === "change" || active?.type === "undo") &&
                    active.item.kind === item.kind &&
                    active.item.record.id === item.record.id;
                  return (
                    <li
                      key={`${item.kind}-${item.record.id}`}
                      aria-current={selected || undefined}
                      className="px-3.5 py-1.5 aria-[current]:bg-secondary sm:px-4"
                    >
                      <div className="flex items-center gap-3 [overflow-wrap:anywhere]">
                        <p className="min-w-0 flex-1 text-sm leading-6">
                          <span className="font-semibold tabular-nums">
                            {money(item.record.amount_minor)}
                          </span>{" "}
                          to {itemPayee(item)}
                          <span className="text-muted-foreground">
                            {" "}
                            · {paidOnLabel(item.record.paid_on)}
                          </span>
                        </p>
                        {canEdit(item) && (
                          <OptionsMenu
                            name={`Paid ${money(item.record.amount_minor)} to ${itemPayee(item)}`}
                            disabled={api.pending || !!active}
                            items={[
                              {
                                label: "Change",
                                disabled: locked,
                                onClick: () =>
                                  start(
                                    { type: "change", item },
                                    item.record.amount_minor,
                                    item.record.paid_on,
                                  ),
                              },
                              {
                                label: "Undo",
                                destructive: true,
                                disabled: locked,
                                onClick: () => start({ type: "undo", item }),
                              },
                            ]}
                          />
                        )}
                      </div>
                      {locked && canEdit(item) && (
                        <p className={`pb-1.5 ${rowDetail}`}>
                          Undo the repayments to {name(user)} first to change
                          this.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {BigInt(member.receivable_minor) > 0n && (
            <p className="text-sm text-primary">
              Owed back to {name(user)}: {money(member.receivable_minor)}
            </p>
          )}
          {BigInt(member.credit_minor) > 0n && (
            <p className="text-sm text-primary">
              Credit to review: {money(member.credit_minor)}
            </p>
          )}
        </fieldset>
      </form>
    </TripDialog>
  );
}
