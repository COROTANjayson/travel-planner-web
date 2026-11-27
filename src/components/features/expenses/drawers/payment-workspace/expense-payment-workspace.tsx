"use client";

import { useState, type ReactNode } from "react";
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
/** The trip Expenses page shows the whole expense around its payments. */
export type ExpenseDetailSlots = {
  badge: ReactNode;
  description: string;
  intro: ReactNode;
  after: (status: PaymentStatus) => ReactNode;
  /** `record` opens the business payment form while one can be recorded. */
  footer: (record?: () => void) => ReactNode;
  initialScreen?: Screen;
};
/** The modal open over the list: a member's payments or Record reservation. */
export type Screen = number | "reservation" | null;
export function ExpensePaymentWorkspace(
  props: Context & { details?: ExpenseDetailSlots },
) {
  const { trip, cost, current, currency, details } = props;
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
  const [screen, setScreen] = useState<Screen>(details?.initialScreen ?? null);
  // The modals sit over this drawer, so they return focus inside it.
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const openScreen = (next: Screen) => {
    setOpener(document.activeElement as HTMLElement);
    setScreen(next);
  };
  const backToDrawer = () => (opener?.isConnected ? opener : null);
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
        finalFocus={backToDrawer}
        status={data}
        user={screen}
        onClose={() => setScreen(null)}
      />
    ) : (
      <ExpensePaymentForm
        {...props}
        finalFocus={backToDrawer}
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
        mobilePresentation={details ? "tall-sheet" : undefined}
        className="activity-details-dialog expense-flow-dialog"
        variant="expense"
        backLabel={props.backLabel ?? "Back to activity"}
        onBack={props.onBack}
        backdropClassName="bg-black/60"
        title={cost.description}
        titleAccessory={details?.badge}
        description={
          details?.description ??
          `${money(cost.amount_minor)} · ${cost.shares.length} ${cost.shares.length === 1 ? "person" : "people"}`
        }
        bodyClassName={details ? "space-y-4 md:space-y-5" : undefined}
        footerClassName={details ? "border-t pt-4 pb-4" : undefined}
        footer={details?.footer(
          canReserve ? () => openScreen("reservation") : undefined,
        )}
        onOpenChange={(open) => {
          if (!open) props.onBack();
        }}
      >
        {details?.intro}
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
            setScreen={openScreen}
            payable={
              details &&
              ((row) =>
                (editor &&
                  BigInt(row.business_remaining_minor) > 0n &&
                  !!props.participants?.some(
                    (p) => p.user_id === row.user_id,
                  )) ||
                (current?.role !== "viewer" &&
                  row.reimbursements.some(
                    (d) =>
                      d.to_user_id === current?.user_id &&
                      BigInt(d.amount_minor) > 0n,
                  )))
            }
          />
        )}
        {data && details?.after(data)}
      </TripDialog>
      {form}
    </>
  );
}
