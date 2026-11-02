"use client";

import { useId, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { useApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ExpenseDateField, ExpensePriceField } from "./expense-fields";
import { Label } from "@/components/ui/label";
import { expenseMoney, moneyInput, parseMoney } from "@/lib/money";
import {
  expenseName,
  useExpensesApi,
  type Currency,
  type Debt,
  type Expense,
  type PaymentStatus,
  type PaymentPreview,
  type TransactionInput,
} from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";
import { ExpenseSelect } from "./expense-forms";
import { TripDialog } from "./trip-dialog";
import { TripError } from "./trip-states";

type Context = {
  finalFocus?: () => HTMLElement | null;
  trip: Trip;
  cost: Expense;
  currency: Currency;
  current?: Participant;
  participants?: Participant[];
  onBack: () => void;
  onFailure: (error: Error) => void | Promise<void>;
};
type Screen =
  | { type: "list" }
  | { type: "choose" }
  | { type: "member"; user: number }
  | { type: "payment"; user?: number; reservation?: boolean; debt?: Debt };
export function ExpensePaymentWorkspace(props: Context) {
  const { trip, cost, current, currency } = props;
  const read = useApi(),
    api = useExpensesApi(trip.id, props.onFailure);
  const query = useQuery({
    queryKey: ["trip", trip.id, "expense-status", cost.id],
    queryFn: ({ signal }) =>
      read<PaymentStatus>(
        `/api/v1/trips/${trip.id}/expenses/${cost.id}/payment-status`,
        { signal },
      ),
    retry: false,
  });
  const [screen, setScreen] = useState<Screen>({ type: "list" });
  const [localError, setLocalError] = useState<Error | null>(null);
  const keys = useRef(new Map<string, { key: string; paidOn: string }>());
  const memberStatusRef = useRef<HTMLDivElement>(null);
  const data = query.data;
  const editor = current?.role === "owner" || current?.role === "editor";
  const money = (value: string) => expenseMoney(value, currency);
  const name = (id: number) =>
    expenseName(data?.people.find((p) => p.user_id === id));
  const member =
    screen.type === "member"
      ? data?.members.find((m) => m.user_id === screen.user)
      : undefined;
  async function receive(debt: Debt) {
    if (current?.role === "viewer" || current?.user_id !== debt.to_user_id)
      return;
    const id = `${debt.payment_id}:${debt.from_user_id}:${debt.to_user_id}:${debt.amount_minor}`;
    if (!keys.current.has(id))
      keys.current.set(id, {
        key: crypto.randomUUID(),
        paidOn: Temporal.Now.zonedDateTimeISO(trip.time_zone)
          .toPlainDate()
          .toString(),
      });
    const submission = keys.current.get(id)!;
    try {
      setLocalError(null);
      await api.saveSettlement(
        {
          payment_id: debt.payment_id,
          from_user_id: debt.from_user_id,
          to_user_id: debt.to_user_id,
          currency: debt.currency,
          amount_minor: debt.amount_minor,
          paid_on: submission.paidOn,
        },
        undefined,
        submission.key,
      );
      memberStatusRef.current?.focus();
    } catch (cause) {
      setLocalError(cause as Error);
    }
  }
  if (screen.type === "payment" && data)
    return (
      <ExpensePaymentForm
        {...props}
        status={data}
        user={screen.user}
        reservation={screen.reservation}
        debt={screen.debt}
        onSaved={(user) =>
          setScreen(user ? { type: "member", user } : { type: "list" })
        }
      />
    );
  const title =
    screen.type === "choose"
      ? "Update a payment"
      : member
        ? `${name(member.user_id)}’s ${cost.description} payment`
        : `${cost.description} payments`;
  const description = member
    ? `${money(member.paid_minor)} of ${money(member.share_minor)} paid`
    : `${money(cost.amount_minor)} total${cost.split_mode === "equal" && cost.shares[0] ? ` · ${money(cost.shares[0].amount_minor)} each` : ""}`;
  return (
    <TripDialog
      open
      finalFocus={props.finalFocus}
      focusTitleOnChange
      presentation="detail"
      className="activity-details-dialog expense-flow-dialog"
      backLabel="Back to activity"
      backdropClassName="bg-black/60"
      title={title}
      description={description}
      onOpenChange={(open) => {
        if (!open) props.onBack();
      }}
      footer={
        data && editor && screen.type === "list" ? (
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => setScreen({ type: "choose" })}
            >
              Update a payment
            </Button>
            <p className="text-xs text-muted-foreground">
              Editors record payments already made.
            </p>
          </div>
        ) : undefined
      }
    >
      {query.isPending && <p role="status">Loading payments…</p>}
      {query.error && (
        <TripError error={query.error} retry={() => void query.refetch()} />
      )}
      {localError && <TripError error={localError} />}
      {data && screen.type === "list" && (
        <div className="expense-payment-list">
          <div className="figma-money-summary">
            <p className="figma-summary-value">
              {money(data.business_paid_minor)} paid to {cost.description}
            </p>
            <p>
              {BigInt(data.business_remaining_minor) >= 0n
                ? `${money(data.business_remaining_minor)} still to pay`
                : `${money((-BigInt(data.business_remaining_minor)).toString())} credit to review`}
            </p>
          </div>
          {editor &&
            cost.planned_coverer_user_id &&
            !data.payments.some(
              (p) => p.payer_user_id === cost.planned_coverer_user_id,
            ) && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  setScreen({ type: "payment", reservation: true })
                }
              >
                Record reservation
              </Button>
            )}
          {data.members.some((m) => BigInt(m.credit_minor) > 0n) && (
            <p className="text-sm text-primary">
              Some contributions exceed the updated shares. Review member
              credits before recording more payments.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Choose a member to see their payment details.
          </p>
          <div className="figma-payment-table">
            <div className="figma-payment-columns figma-table-heading">
              <span>Member</span>
              <span>Share</span>
              <span>Paid</span>
              <span>Left</span>
            </div>
            {data.members.map((row) => (
              <button
                key={row.user_id}
                type="button"
                className="figma-payment-row"
                aria-label={`View ${name(row.user_id)}’s ${cost.description} payment`}
                onClick={() => setScreen({ type: "member", user: row.user_id })}
              >
                <span className="figma-payment-columns">
                  <strong>{name(row.user_id)}</strong>
                  <span>{money(row.share_minor)}</span>
                  <span>{money(row.paid_minor)}</span>
                  <span>{money(row.remaining_minor)}</span>
                </span>
                <span className="payment-row-footer">
                  <span className="figma-payment-note">
                    {BigInt(row.receivable_minor) > 0n
                      ? `${BigInt(row.remaining_minor) === 0n ? "Own share paid" : `${money(row.remaining_minor)} still to pay`} · owed back ${money(row.receivable_minor)}`
                      : BigInt(row.credit_minor) > 0n
                        ? `Credit for review ${money(row.credit_minor)}`
                        : BigInt(row.remaining_minor) === 0n
                          ? "Paid"
                          : `${BigInt(row.business_remaining_minor) > 0n ? `${money(row.business_remaining_minor)} to ${cost.description}` : ""}${row.reimbursements
                              .filter((d) => BigInt(d.amount_minor) > 0n)
                              .map(
                                (d) =>
                                  `${BigInt(row.business_remaining_minor) > 0n ? " + " : ""}${money(d.amount_minor)} to ${name(d.to_user_id)}`,
                              )
                              .join("")}`}
                  </span>
                  <span className="payment-row-action">
                    View payment <ChevronRight aria-hidden="true" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {data && screen.type === "choose" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose the member whose payment you want to update.
          </p>
          {data.members.map((row) => (
            <Button
              variant="outline"
              className="figma-select-button"
              key={row.user_id}
              disabled={BigInt(row.remaining_minor) <= 0n}
              onClick={() => setScreen({ type: "payment", user: row.user_id })}
            >
              <span>{name(row.user_id)}</span>
              <span>
                {BigInt(row.remaining_minor) <= 0n
                  ? "Share fully paid"
                  : `${money(row.remaining_minor)} left`}
              </span>
            </Button>
          ))}
          {editor && BigInt(data.business_remaining_minor) > 0n && (
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setScreen({ type: "payment", reservation: true })}
            >
              Record reservation or advance
            </Button>
          )}
        </div>
      )}
      {data && member && (
        <div className="expense-member-detail">
          <div
            ref={memberStatusRef}
            tabIndex={-1}
            className="figma-money-summary"
            aria-live="polite"
          >
            <p className="figma-summary-value">
              {BigInt(member.remaining_minor) > 0n
                ? `${money(member.remaining_minor)} left to pay`
                : "Share fully paid"}
            </p>
            <p>
              {BigInt(member.business_remaining_minor) > 0n
                ? `${money(member.business_remaining_minor)} to ${cost.description}`
                : member.reimbursements
                    .filter((d) => BigInt(d.amount_minor) > 0n)
                    .map(
                      (d) =>
                        `To ${name(d.to_user_id)} · reservation reimbursement`,
                    )
                    .join(", ") || "All payments received"}
            </p>
          </div>
          <div className="figma-member-line">
            <strong>Paid to {cost.description}</strong>
            <span>
              {money(
                data.payments
                  .filter((p) => p.payer_user_id === member.user_id)
                  .reduce((n, p) => n + BigInt(p.amount_minor), 0n)
                  .toString(),
              )}
            </span>
          </div>
          {data.payments
            .filter((p) => p.payer_user_id === member.user_id)
            .map((p) => (
              <p className="member-paid-date" key={p.id}>
                Paid ·{" "}
                {new Date(`${p.paid_on}T12:00:00Z`).toLocaleDateString(
                  undefined,
                  { timeZone: "UTC", month: "long", day: "numeric" },
                )}
              </p>
            ))}
          {BigInt(member.business_remaining_minor) > 0n && (
            <div className="space-y-3">
              <div className="figma-member-line">
                <strong>To {cost.description}</strong>
                <span>{money(member.business_remaining_minor)}</span>
              </div>
              {editor && (
                <Button
                  className="w-full"
                  onClick={() =>
                    setScreen({ type: "payment", user: member.user_id })
                  }
                >
                  Update payment
                </Button>
              )}
            </div>
          )}
          {member.reimbursements.map((debt) => {
            const original =
              data.payments
                .find((p) => p.id === debt.payment_id)
                ?.allocations.find((a) => a.user_id === member.user_id)
                ?.amount_minor ?? debt.amount_minor;
            const receipts = data.receipts.filter(
              (s) =>
                s.payment_id === debt.payment_id &&
                s.from_user_id === member.user_id &&
                s.to_user_id === debt.to_user_id,
            );
            return (
              <section
                key={`${debt.payment_id}-${debt.to_user_id}`}
                className="figma-member-debt"
              >
                <div className="figma-member-line">
                  <strong>To {name(debt.to_user_id)}</strong>
                  {current?.role !== "viewer" &&
                  current?.user_id === debt.to_user_id &&
                  BigInt(debt.amount_minor) > 0n ? (
                    <button
                      type="button"
                      className="repayment-amount"
                      aria-label="Record a partial repayment"
                      title="Record a partial repayment"
                      onClick={() =>
                        setScreen({
                          type: "payment",
                          user: member.user_id,
                          debt,
                        })
                      }
                    >
                      {money(original)}
                    </button>
                  ) : (
                    <span>{money(original)}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {BigInt(debt.amount_minor) > 0n
                    ? receipts.length
                      ? `${money(debt.amount_minor)} remaining`
                      : "Not paid yet"
                    : "Paid · received"}
                </p>
                {BigInt(debt.amount_minor) > 0n && (
                  <>
                    {current?.role !== "viewer" &&
                    current?.user_id === debt.to_user_id ? (
                      <>
                        <Button
                          className="w-full"
                          disabled={api.pending}
                          onClick={() => void receive(debt)}
                        >
                          Mark {money(debt.amount_minor)} paid
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Only {name(debt.to_user_id)} can mark this reimbursement
                        as received.
                      </p>
                    )}
                  </>
                )}
              </section>
            );
          })}
          {BigInt(member.receivable_minor) > 0n && (
            <p className="text-sm text-primary">
              Owed back to {name(member.user_id)}:{" "}
              {money(member.receivable_minor)}
            </p>
          )}
          {BigInt(member.credit_minor) > 0n && (
            <p className="text-sm text-primary">
              Credit requiring correction: {money(member.credit_minor)}
            </p>
          )}
          <p className="member-payment-explanation">
            {BigInt(member.remaining_minor) > 0n
              ? `Once the ${money(member.remaining_minor)} is received, ${name(member.user_id)}’s whole ${money(member.share_minor)} share is marked Paid.`
              : "The whole share is marked Paid."}
          </p>
          <p className="member-payment-explanation">
            The share stays {money(member.share_minor)}. The reservation is
            already included in that amount.
          </p>
        </div>
      )}
    </TripDialog>
  );
}

function ExpensePaymentForm(
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
      className="activity-details-dialog expense-flow-dialog"
      backLabel="Back to activity"
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
        className={`figma-expense-form expense-payment-form ${reservation ? "reservation-form" : "member-update-form"}`}
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
            <div className="figma-money-summary payment-coverage-preview">
              <h3 className="text-xl font-semibold">
                {reservation ? "What this covers" : "After this payment"}
              </h3>
              {reservation ? (
                <>
                  <div className="figma-member-line">
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
                      <div className="reservation-shared-coverage" key={amount}>
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
              <p className="payment-form-help">
                The reservation is not another expense.
              </p>
              {preview.data && (
                <p className="payment-form-help payment-form-followup">
                  {name(payer)}’s {money(preview.data.own_covered_minor)} share
                  is now paid.
                </p>
              )}
            </>
          ) : (
            <p className="payment-form-help">
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
