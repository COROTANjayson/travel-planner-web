"use client";

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
  type Debt,
  type PaymentStatus,
  type PaymentPreview,
  type TransactionInput,
} from "@/lib/expenses";
import type { Context } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { ExpenseSelect } from "@/components/features/expenses/expense-forms";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";

export function ExpensePaymentForm(
  props: Context & {
    status: PaymentStatus;
    user?: number;
    reservation?: boolean;
    debt?: Debt;
    onSaved: (user?: number) => void;
  },
) {
  const { trip, cost, status, user, reservation, current } = props;
  const read = useApi();
  const api = useExpensesApi(trip.id, props.onFailure);
  const formID = useId();
  // A failed response may already have committed, so edits must keep the submission key.
  const key = useRef("");
  const [payer, setPayer] = useState(
    reservation
      ? (cost.planned_coverer_user_id ?? current?.user_id ?? 0)
      : (user ?? 0),
  );
  const member = status.members.find((m) => m.user_id === payer);
  const possible =
    member?.reimbursements.filter((d) => BigInt(d.amount_minor) > 0n) ?? [];
  const businessRemaining = member?.business_remaining_minor ?? "0";
  const debtKey = (d: Debt) => `${d.payment_id}:${d.to_user_id}`;
  const [payee, setPayee] = useState(
    props.debt
      ? debtKey(props.debt)
      : !reservation && BigInt(businessRemaining) <= 0n && possible.length
        ? debtKey(possible[0])
        : "business",
  );
  const debt = possible.find((d) => debtKey(d) === payee);
  const [date, setDate] = useState(
    Temporal.Now.zonedDateTimeISO(trip.time_zone).toPlainDate().toString(),
  );
  const [amount, setAmount] = useState(
    moneyInput(
      props.debt?.amount_minor ??
        (reservation
          ? (cost.planned_cover_amount_minor ?? status.business_remaining_minor)
          : (debt?.amount_minor ?? businessRemaining)),
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
    payee === "business"
      ? editor && !!props.participants?.some((p) => p.user_id === payer)
      : current?.role !== "viewer" &&
        !!debt &&
        current?.user_id === debt.to_user_id;
  let minor = "",
    problem = "";
  try {
    minor = parseMoney(amount, props.currency.decimals);
    if (BigInt(minor) <= 0n) throw new Error("Enter a positive amount.");
    if (debt && BigInt(minor) > BigInt(debt.amount_minor))
      throw new Error("Repayment exceeds the outstanding amount.");
  } catch (cause) {
    problem = (cause as Error).message;
  }
  const input: TransactionInput = {
    expense_id: cost.id,
    currency: cost.currency,
    amount_minor: minor,
    paid_on: date,
    payer_user_id: payer,
    ...(!reservation ? { member_user_id: payer } : {}),
  };
  const preview = useQuery({
    queryKey: [
      "trip",
      trip.id,
      "payment-preview",
      cost.id,
      payer,
      minor,
      date,
      reservation,
    ],
    enabled: allowed && payee === "business" && !problem && !!date && !!payer,
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
      if (payee === "business" && (!preview.data || preview.error))
        throw preview.error ?? new Error("Wait for the coverage preview.");
      if (!key.current) key.current = crypto.randomUUID();
      const saved =
        payee === "business"
          ? await api.saveTransaction(
              "expense_payments",
              input,
              undefined,
              key.current,
            )
          : debt &&
            (await api.saveSettlement(
              {
                payment_id: debt.payment_id,
                from_user_id: payer,
                to_user_id: debt.to_user_id,
                currency: cost.currency,
                amount_minor: minor,
                paid_on: date,
              },
              undefined,
              key.current,
            ));
      if (!saved) return;
      props.onSaved(reservation ? undefined : payer);
    } catch (cause) {
      setValidation(cause as Error);
    }
  }
  const after = preview.data?.after.members.find((m) => m.user_id === payer);
  const title = reservation
    ? "Record reservation"
    : `Update ${name(payer)}’s payment`;
  const description = reservation
    ? `${cost.description} · already included in the ${money(cost.amount_minor)} price`
    : `${cost.description} · ${name(payer)}’s share ${money(member?.share_minor ?? "0")}`;
  return (
    <TripDialog
      open
      finalFocus={props.finalFocus}
      focusTitleOnChange
      presentation="detail"
      className="activity-details-dialog expense-flow-dialog [&_[data-slot='input']]:min-h-12 [&_[data-slot='input']]:rounded-[0.875rem] [&_[data-slot='select-trigger']]:[min-height:3rem] [&_[data-slot='select-trigger']]:[border-radius:0.875rem] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[min-height:44px] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[padding:0] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[text-align:left] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[white-space:normal] [&_.activity-detail-navigation_.trip-people[data-slot='button']]:[min-width:44px] [&_.activity-detail-navigation_.trip-people[data-slot='button']]:[justify-content:flex-end] [&_.activity-detail-navigation_.trip-people[data-slot='button']]:[border-radius:9999px] [&_.activity-detail-navigation_.trip-people[data-slot='button']:focus-visible]:[outline:2px_solid_var(--ring)] [&_.activity-detail-navigation_.trip-people[data-slot='button']:focus-visible]:[outline-offset:2px] [&_[data-slot='select-trigger']_>_svg]:[display:block] [&_.repayment-panel_[data-slot='input']]:[border-radius:0] [&_.repayment-panel_[data-slot='input']]:[border-color:var(--ocean-text)] [&_.repayment-panel_[data-slot='input']]:[background:transparent] [&_.repayment-panel_[data-slot='input']]:[color:#fff] [&_.repayment-panel_[data-slot='input']]:[caret-color:#fff] [&_.repayment-panel_[data-slot='input']:focus-visible]:[outline:2px_solid_var(--aqua)] [&_.repayment-panel_[data-slot='input']:focus-visible]:[outline-offset:4px] [&_.repayment-panel_[data-slot='input']:focus-visible]:[box-shadow:none] [&_.repayment-panel_[data-slot='input'][aria-invalid='true']]:[border-color:#ffd5ca] [&_.repayment-panel_[data-slot='input'][aria-invalid='true']]:[box-shadow:none]"
      variant="expense"
      backLabel="Back to payments"
      onBack={() => props.onSaved(user)}
      backdropClassName="bg-black/60"
      title={title}
      description={description}
      busy={api.pending}
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) props.onBack();
      }}
      footer={
        <Button
          className="w-full"
          type="submit"
          form={formID}
          disabled={
            !allowed ||
            api.pending ||
            !!problem ||
            (payee === "business" &&
              (!preview.data || preview.isFetching || !!preview.error))
          }
        >
          {api.pending
            ? "Saving…"
            : reservation
              ? "Confirm payment"
              : payee === "business"
                ? `Confirm ${minor ? money(minor) : ""} paid`
                : "Confirm received"}
        </Button>
      }
    >
      <form
        id={formID}
        className={`figma-expense-form expense-payment-form pt-1.5 [&_fieldset>*:not(:last-child)]:mb-8 ${reservation ? "reservation-form" : "member-update-form"}`}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void submit();
        }}
      >
        <fieldset disabled={api.pending} className="space-y-6 min-w-0">
          {reservation ? (
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
          ) : (
            <ExpenseSelect
              id={`${formID}-payee`}
              label="Who received the payment?"
              value={payee}
              options={[
                ...(BigInt(businessRemaining) > 0n
                  ? [
                      {
                        value: "business",
                        label: `${cost.description} · ${money(businessRemaining)} remaining`,
                      },
                    ]
                  : []),
                ...possible.map((d) => ({
                  value: debtKey(d),
                  label: `${name(d.to_user_id)} · ${money(d.amount_minor)} remaining`,
                })),
              ]}
              onChange={(value) => {
                setPayee(value);
                const chosen = possible.find((d) => debtKey(d) === value);
                setAmount(
                  moneyInput(
                    chosen?.amount_minor ??
                      member?.business_remaining_minor ??
                      "0",
                    props.currency.decimals,
                  ),
                );
                change();
              }}
            />
          )}
          <div className="space-y-2">
            <Label htmlFor={`${formID}-amount`}>
              Amount paid · {cost.currency}
            </Label>
            <ExpensePriceField
              currency={props.currency}
              id={`${formID}-amount`}
              inputMode="decimal"
              value={amount}
              required
              onChange={(e) => {
                setAmount(e.target.value);
                change();
              }}
            />
          </div>
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
          {payee === "business" && preview.isFetching && (
            <p role="status" className="text-sm">
              Calculating what this covers…
            </p>
          )}
          {preview.data && payee === "business" && (
            <div className="figma-money-summary [&>p:not(.figma-summary-value)]:text-sm [&>p:not(.figma-summary-value)]:leading-[1.7] [display:grid] [gap:1rem] [background:var(--secondary)] [overflow-wrap:anywhere] [border:1px_solid_var(--border)] [padding:20px] [border-radius:18px] payment-coverage-preview [.expense-payment-form_&]:[min-height:192px] [.expense-payment-form_&]:[gap:20px] [.expense-payment-form_&_h3]:[font-size:22px] [.expense-payment-form_&_h3]:[line-height:30px] [.expense-payment-form_&_h3]:[font-weight:700] [.expense-payment-form_&_p]:[font-size:18px] [.expense-payment-form_&_p]:[line-height:26px] [.expense-payment-form_&_.figma-member-line]:[font-size:18px] [.expense-payment-form_&_.figma-member-line]:[line-height:26px] [.expense-payment-form_&_p.text-primary]:[font-weight:700] [.reservation-form_&]:[min-height:256px] [.reservation-form_&_p]:[font-size:16px] [.expense-payment-form_&]:[margin-top:38px] [&:has(>_.figma-summary-action)]:[display:flex] [&:has(>_.figma-summary-action)]:[flex-wrap:wrap] [&:has(>_.figma-summary-action)]:[align-items:center] [&:has(>_.figma-summary-action)_>_.figma-summary-value]:[flex-basis:100%] [&:has(>_.figma-summary-action)_>_p:not(.figma-summary-value)]:[flex:1_1_8rem]">
              <h3 className="text-xl font-semibold">
                {reservation ? "What this covers" : "After this payment"}
              </h3>
              {reservation ? (
                <>
                  <div className="figma-member-line [&>:last-child]:shrink-0 [&>:last-child]:tabular-nums [display:flex] [align-items:start] [justify-content:space-between] [gap:1rem] [overflow-wrap:anywhere]">
                    <span>{name(payer)}’s own share</span>
                    <span>{money(preview.data.own_covered_minor)}</span>
                  </div>
                  {[
                    ...new Set(
                      preview.data.reimbursements.map((s) => s.amount_minor),
                    ),
                  ].map((amount) => {
                    const group = preview.data!.reimbursements.filter(
                      (s) => s.amount_minor === amount,
                    );
                    return (
                      <div
                        className="reservation-shared-coverage [&_p:first-child]:[font-size:14px] [&_p:last-child]:[font-size:16px] [&_p:last-child]:[color:var(--primary)] [&_p:last-child]:[font-weight:700] [&_p:last-child]:[margin-top:4px]"
                        key={amount}
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
                          {name(payer)} {money(amount)}
                        </p>
                      </div>
                    );
                  })}
                  <p>
                    Still payable to {cost.description}:{" "}
                    {money(preview.data.business_remaining_minor)}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Paid: {money(after?.paid_minor ?? "0")} of{" "}
                    {money(member?.share_minor ?? "0")}
                  </p>
                  {after?.reimbursements
                    .filter((d) => BigInt(d.amount_minor) > 0n)
                    .map((d) => (
                      <p
                        key={`${d.payment_id}-${d.to_user_id}`}
                        className="text-primary"
                      >
                        Still owed to {name(d.to_user_id)}:{" "}
                        {money(d.amount_minor)}
                      </p>
                    ))}
                </>
              )}
            </div>
          )}
          {reservation ? (
            <>
              <p className="payment-form-help [.expense-payment-form_&]:[margin-top:64px] [.expense-payment-form_&]:[font-size:14px] [.expense-payment-form_&]:[line-height:28px] [.expense-payment-form_&]:[color:var(--muted-foreground)] [.expense-payment-form_&]:[max-width:31ch] [.reservation-form_&]:[margin-top:44px] [.reservation-form_&]:[max-width:none]">
                The reservation is not another expense.
              </p>
              {preview.data && (
                <p className="payment-form-help payment-form-followup [.expense-payment-form_&]:[margin-top:64px] [.expense-payment-form_&]:[font-size:14px] [.expense-payment-form_&]:[line-height:28px] [.expense-payment-form_&]:[color:var(--muted-foreground)] [.expense-payment-form_&]:[max-width:31ch] [.reservation-form_&]:[margin-top:44px] [.reservation-form_&]:[max-width:none] [.expense-payment-form_&]:[margin-top:4px]">
                  {name(payer)}’s {money(preview.data.own_covered_minor)} share
                  is now paid.
                </p>
              )}
            </>
          ) : (
            <p className="payment-form-help [.expense-payment-form_&]:[margin-top:64px] [.expense-payment-form_&]:[font-size:14px] [.expense-payment-form_&]:[line-height:28px] [.expense-payment-form_&]:[color:var(--muted-foreground)] [.expense-payment-form_&]:[max-width:31ch] [.reservation-form_&]:[margin-top:44px] [.reservation-form_&]:[max-width:none]">
              Recording only part? Enter the amount that was actually paid.
            </p>
          )}
          <p
            className={
              allowed ? "sr-only" : "text-sm leading-7 text-muted-foreground"
            }
          >
            {payee === "business"
              ? "Only a planner/editor can confirm a payment to the business."
              : `Only ${debt ? name(debt.to_user_id) : "the recipient"} can mark this reimbursement as received.`}
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
