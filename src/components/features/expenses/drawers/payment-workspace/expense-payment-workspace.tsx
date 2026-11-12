"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { useApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { expenseMoney } from "@/lib/money";
import {
  expenseName,
  useExpensesApi,
  type Currency,
  type Debt,
  type Expense,
  type PaymentStatus,
} from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";
import { ExpensePaymentForm } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-form";
import { PaymentChooseScreen } from "@/components/features/expenses/drawers/payment-workspace/payment-choose-screen";
import { PaymentListScreen } from "@/components/features/expenses/drawers/payment-workspace/payment-list-screen";
import { PaymentMemberDetail } from "@/components/features/expenses/drawers/payment-workspace/payment-member-detail";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";

export type Context = {
  finalFocus?: () => HTMLElement | null;
  trip: Trip;
  cost: Expense;
  currency: Currency;
  current?: Participant;
  participants?: Participant[];
  onBack: () => void;
  backLabel?: string;
  onFailure: (error: Error) => void | Promise<void>;
};
export type Screen =
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
      className="activity-details-dialog expense-flow-dialog [&_[data-slot='input']]:min-h-12 [&_[data-slot='input']]:rounded-[0.875rem] [&_[data-slot='select-trigger']]:[min-height:3rem] [&_[data-slot='select-trigger']]:[border-radius:0.875rem] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[min-height:44px] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[padding:0] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[text-align:left] [&_[data-slot='trip-dialog-footer']_.expense-split-status_[data-slot='button']]:[white-space:normal] [&_.activity-detail-navigation_.trip-people[data-slot='button']]:[min-width:44px] [&_.activity-detail-navigation_.trip-people[data-slot='button']]:[justify-content:flex-end] [&_.activity-detail-navigation_.trip-people[data-slot='button']]:[border-radius:9999px] [&_.activity-detail-navigation_.trip-people[data-slot='button']:focus-visible]:[outline:2px_solid_var(--ring)] [&_.activity-detail-navigation_.trip-people[data-slot='button']:focus-visible]:[outline-offset:2px] [&_[data-slot='select-trigger']_>_svg]:[display:block] [&_.repayment-panel_[data-slot='input']]:[border-radius:0] [&_.repayment-panel_[data-slot='input']]:[border-color:var(--ocean-text)] [&_.repayment-panel_[data-slot='input']]:[background:transparent] [&_.repayment-panel_[data-slot='input']]:[color:#fff] [&_.repayment-panel_[data-slot='input']]:[caret-color:#fff] [&_.repayment-panel_[data-slot='input']:focus-visible]:[outline:2px_solid_var(--aqua)] [&_.repayment-panel_[data-slot='input']:focus-visible]:[outline-offset:4px] [&_.repayment-panel_[data-slot='input']:focus-visible]:[box-shadow:none] [&_.repayment-panel_[data-slot='input'][aria-invalid='true']]:[border-color:#ffd5ca] [&_.repayment-panel_[data-slot='input'][aria-invalid='true']]:[box-shadow:none]"
      variant="expense"
      backLabel={
        screen.type === "list"
          ? (props.backLabel ?? "Back to activity")
          : "Back to payments"
      }
      onBack={
        screen.type === "list"
          ? props.onBack
          : () => setScreen({ type: "list" })
      }
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
        <PaymentListScreen
          data={data}
          cost={cost}
          editor={editor}
          money={money}
          name={name}
          setScreen={setScreen}
        />
      )}
      {data && screen.type === "choose" && (
        <PaymentChooseScreen
          data={data}
          editor={editor}
          money={money}
          name={name}
          setScreen={setScreen}
        />
      )}
      {data && member && (
        <PaymentMemberDetail
          data={data}
          member={member}
          cost={cost}
          current={current}
          editor={editor}
          api={api}
          receive={receive}
          memberStatusRef={memberStatusRef}
          money={money}
          name={name}
          setScreen={setScreen}
        />
      )}
    </TripDialog>
  );
}
