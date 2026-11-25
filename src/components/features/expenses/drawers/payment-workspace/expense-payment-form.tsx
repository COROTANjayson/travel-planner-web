"use client";

import { ExpenseSummary } from "@/components/features/expenses/expense-layout";
import { ExpenseAmountPanel } from "@/components/features/expenses/expense-amount-panel";
import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { useApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ExpenseDateField,
  ExpensePriceField,
} from "@/components/features/expenses/expense-fields";
import { Label } from "@/components/ui/label";
import { expenseMoney, moneyInput, parseMoney } from "@/lib/money";
import {
  expenseName,
  useExpensesApi,
  type PaymentStatus,
  type PaymentPreview,
  type TransactionInput,
} from "@/lib/expenses";
import type { Context } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { TripDialog } from "@/components/shared/trip-dialog";
import { expenseModalProps } from "@/components/shared/trip-dialog-variants";
import { TripError } from "@/components/shared/trip-states";

/**
 * Record reservation: a payment to the business by whoever paid first, which
 * the API allocates own-share-first. Members' own payments and repayments are
 * recorded in their payment modal (member-payment-modal.tsx).
 */
export function ExpensePaymentForm(
  props: Context & { status: PaymentStatus; onClose: () => void },
) {
  const { trip, cost, status, current } = props;
  const read = useApi();
  const api = useExpensesApi(trip.id, props.onFailure);
  const formID = useId();
  // A failed response may already have committed, so edits must keep the submission key.
  const key = useRef("");
  const reservationUnpaid =
    !!cost.planned_coverer_user_id &&
    !status.payments.some(
      (p) => p.payer_user_id === cost.planned_coverer_user_id,
    );
  const plannedAmount = BigInt(cost.planned_cover_amount_minor || "0");
  const [payer, setPayer] = useState(
    cost.planned_coverer_user_id || current?.user_id || 0,
  );
  const [date, setDate] = useState(
    Temporal.Now.zonedDateTimeISO(trip.time_zone).toPlainDate().toString(),
  );
  const [amount, setAmount] = useState(
    moneyInput(
      reservationUnpaid &&
        plannedAmount > 0n &&
        plannedAmount <= BigInt(status.business_remaining_minor)
        ? plannedAmount.toString()
        : status.business_remaining_minor,
      props.currency.decimals,
    ),
  );
  const [validation, setValidation] = useState<Error | null>(null);
  function change() {
    setValidation(null);
    api.reset();
  }
  const editor = current?.role === "owner" || current?.role === "editor";
  const allowed =
    editor && !!props.participants?.some((p) => p.user_id === payer);
  let minor = "",
    problem = "";
  try {
    minor = parseMoney(amount, props.currency.decimals);
    if (BigInt(minor) <= 0n) throw new Error("Enter a positive amount.");
  } catch (cause) {
    problem = (cause as Error).message;
  }
  const input: TransactionInput = {
    expense_id: cost.id,
    currency: cost.currency,
    amount_minor: minor,
    paid_on: date,
    payer_user_id: payer,
  };
  const preview = useQuery({
    queryKey: ["trip", trip.id, "payment-preview", cost.id, payer, minor, date],
    enabled: allowed && !problem && !!date && !!payer,
    retry: false,
    queryFn: ({ signal }) =>
      read<PaymentPreview>(
        `/api/v1/trips/${trip.id}/expenses/${cost.id}/payment-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal,
        },
      ),
  });
  const money = (value: string) => expenseMoney(value, props.currency);
  const name = (id: number) =>
    expenseName(
      props.participants?.find((p) => p.user_id === id) ??
        status.people.find((p) => p.user_id === id),
    );
  async function submit() {
    if (!allowed || api.pending) return;
    try {
      if (problem) throw new Error(problem);
      if (!preview.data || preview.error)
        throw preview.error ?? new Error("Wait for the coverage preview.");
      if (!key.current) key.current = crypto.randomUUID();
      const saved = await api.saveTransaction(
        "expense_payments",
        input,
        undefined,
        key.current,
      );
      if (saved) props.onClose();
    } catch (cause) {
      setValidation(cause as Error);
    }
  }
  return (
    <TripDialog
      open
      finalFocus={props.finalFocus}
      {...expenseModalProps}
      title="Record reservation"
      description={`${cost.description} · already included in the ${money(cost.amount_minor)} price`}
      busy={api.pending}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      footer={
        <div className="flex gap-3 sm:justify-end max-sm:[&>*]:flex-1 [&>[data-slot=button]]:justify-center!">
          <Button
            type="button"
            variant="outline"
            disabled={api.pending}
            onClick={props.onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formID}
            disabled={
              !allowed ||
              api.pending ||
              !!problem ||
              !preview.data ||
              preview.isFetching ||
              !!preview.error
            }
          >
            {api.pending ? "Saving…" : "Confirm payment"}
          </Button>
        </div>
      }
    >
      <form
        id={formID}
        className="figma-expense-form expense-payment-form reservation-form"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void submit();
        }}
      >
        <fieldset disabled={api.pending} className="min-w-0 space-y-5">
          <ExpenseSelect
            id={`${formID}-payer`}
            label="Who paid?"
            value={String(payer)}
            disabled={!props.participants}
            options={(props.participants ?? []).map((p) => ({
              value: String(p.user_id),
              label: expenseName(p),
            }))}
            onChange={(value) => {
              setPayer(Number(value));
              change();
            }}
          />
          <ExpenseAmountPanel
            inputID={`${formID}-amount`}
            label="Amount paid"
            currency={cost.currency}
          >
            <ExpensePriceField
              currency={props.currency}
              id={`${formID}-amount`}
              value={amount}
              required
              onChange={(e) => {
                setAmount(e.target.value);
                change();
              }}
            />
          </ExpenseAmountPanel>
          <div className="space-y-2">
            <Label htmlFor={`${formID}-date`}>Date paid</Label>
            <ExpenseDateField
              id={`${formID}-date`}
              min="0001-01-01"
              max="9999-12-31"
              value={date}
              required
              onChange={(e) => {
                setDate(e.target.value);
                change();
              }}
            />
          </div>
          {preview.isFetching && (
            <p role="status" className="text-sm">
              Calculating what this covers…
            </p>
          )}
          {preview.data && (
            <ExpenseSummary>
              <h3 className="text-xl font-semibold">What this covers</h3>
              <div className="flex items-start justify-between gap-4 [overflow-wrap:anywhere] [&>:last-child]:shrink-0 [&>:last-child]:tabular-nums">
                <span>{name(payer)}’s own share</span>
                <span>{money(preview.data.own_covered_minor)}</span>
              </div>
              {[
                ...new Set(
                  preview.data.reimbursements.map((s) => s.amount_minor),
                ),
              ].map((value) => {
                const group = preview.data!.reimbursements.filter(
                  (s) => s.amount_minor === value,
                );
                return (
                  <div
                    className="space-y-1 [&_p:last-child]:font-bold [&_p:last-child]:text-primary"
                    key={value}
                  >
                    <p>
                      {new Intl.ListFormat(undefined, {
                        style: "long",
                        type: "conjunction",
                      }).format(group.map((s) => name(s.user_id)))}
                    </p>
                    <p>
                      {group.length > 1
                        ? "Each owes"
                        : `${name(group[0].user_id)} owes`}{" "}
                      {name(payer)} {money(value)}
                    </p>
                  </div>
                );
              })}
              <p>
                Still payable to {cost.description}:{" "}
                {money(preview.data.business_remaining_minor)}
              </p>
            </ExpenseSummary>
          )}
          <p className="text-sm leading-6 text-muted-foreground">
            The reservation is not another expense.
          </p>
          <p
            className={
              allowed ? "sr-only" : "text-sm leading-7 text-muted-foreground"
            }
          >
            Only a planner/editor can confirm a payment to the business.
          </p>
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          {(validation || api.error || preview.error) && (
            <TripError error={validation ?? api.error ?? preview.error} />
          )}
        </fieldset>
      </form>
    </TripDialog>
  );
}
