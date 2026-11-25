"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { expenseMoney } from "@/lib/money";
import {
  expenseName,
  type Currency,
  type Expense,
  type PaymentStatus,
} from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";
import { ExpensePaymentForm } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-form";
import { MemberPaymentModal } from "@/components/features/expenses/drawers/payment-workspace/member-payment-modal";
import { PaymentListScreen } from "@/components/features/expenses/drawers/payment-workspace/payment-list-screen";
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
/** The modal open over the list: a member's payments or Record reservation. */
export type Screen = number | "reservation" | null;
export function ExpensePaymentWorkspace(props: Context) {
  const { trip, cost, current, currency } = props;
  const read = useApi();
  const query = useQuery({
    queryKey: ["trip", trip.id, "expense-status", cost.id],
    queryFn: ({ signal }) =>
      read<PaymentStatus>(
        `/api/v1/trips/${trip.id}/expenses/${cost.id}/payment-status`,
        { signal },
      ),
    retry: false,
  });
  const [screen, setScreen] = useState<Screen>(null);
  const data = query.data;
  const editor = current?.role === "owner" || current?.role === "editor";
  const money = (value: string) => expenseMoney(value, currency);
  const name = (id: number) =>
    expenseName(data?.people.find((p) => p.user_id === id));
  // Tapping a member opens their payment modal over this drawer. Its key
  // follows the recorded payments, so an undo or change starts it fresh.
  const recordedKey = data
    ? `${data.payments.map((p) => `${p.id}.${p.version}`).join()}:${data.receipts.map((s) => `${s.id}.${s.version}`).join()}`
    : "";
  const form =
    screen &&
    data &&
    (screen !== "reservation" ? (
      <MemberPaymentModal
        key={`${screen}:${recordedKey}`}
        {...props}
        status={data}
        user={screen}
        onClose={() => setScreen(null)}
      />
    ) : (
      <ExpensePaymentForm
        {...props}
        status={data}
        onClose={() => setScreen(null)}
      />
    ));
  const canReserve =
    !!data && editor && BigInt(data.business_remaining_minor) > 0n;
  return (
    <>
      <TripDialog
        open
        finalFocus={props.finalFocus}
        focusTitleOnChange
        presentation="detail"
        className="activity-details-dialog expense-flow-dialog"
        variant="expense"
        backLabel={props.backLabel ?? "Back to activity"}
        onBack={props.onBack}
        backdropClassName="bg-black/60"
        title={cost.description}
        description={`${money(cost.amount_minor)} · ${cost.shares.length} ${cost.shares.length === 1 ? "person" : "people"}`}
        onOpenChange={(open) => {
          if (!open) props.onBack();
        }}
      >
        {query.isPending && <p role="status">Loading payments…</p>}
        {query.error && (
          <TripError error={query.error} retry={() => void query.refetch()} />
        )}
        {data && (
          <PaymentListScreen
            data={data}
            cost={cost}
            money={money}
            name={name}
            canReserve={canReserve}
            setScreen={setScreen}
          />
        )}
      </TripDialog>
      {form}
    </>
  );
}
