"use client";

import type { ComponentProps, RefObject } from "react";
import { ActivityExpenseForm } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { TripDialog } from "@/components/shared/trip-dialog";
import { activityKey } from "@/lib/activity-expenses";
import { ApiError } from "@/lib/api";
import type { Debt, TransactionInput, useExpensesApi } from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";

type FormProps = ComponentProps<typeof ActivityExpenseForm>;

export function MarkAsPaidDialog({
  debt,
  setDebt,
  api,
  people,
  currencies,
  current,
  participants,
  trip,
  ledger,
  close,
  finalFocus,
  receiptKey,
  backLabel,
  description,
}: {
  debt: Debt | null;
  setDebt: (debt: Debt | null) => void;
  api: Pick<
    ReturnType<typeof useExpensesApi>,
    "pending" | "error" | "reset" | "saveSettlement"
  >;
  people: FormProps["people"];
  currencies: FormProps["currencies"];
  current: Participant;
  participants?: Participant[];
  trip: Trip;
  ledger: FormProps["ledger"];
  close: () => void;
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
  receiptKey: RefObject<string>;
  backLabel?: string;
  description?: string;
}) {
  return (
    <TripDialog
      className={
        backLabel
          ? "activity-details-dialog expense-flow-dialog repayment-dialog"
          : "expense-editor-dialog"
      }
      presentation={backLabel ? "detail" : "dialog"}
      backLabel={backLabel}
      onBack={backLabel ? close : undefined}
      backdropClassName="bg-black/60"
      open={!!debt}
      title={backLabel ? "Confirm money received" : "Mark as paid"}
      description={backLabel ? undefined : (description ?? debt?.description)}
      busy={api.pending}
      disablePointerDismissal
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {debt && (
        <ActivityExpenseForm
          key={`${debt.payment_id}:${debt.loan_id}:${debt.from_user_id}`}
          editor={{ type: "repayment", debt }}
          simpleRepayment={!!backLabel}
          activityID={activityKey(debt)}
          activities={[]}
          people={people}
          currencies={currencies}
          userID={current.user_id}
          currentUserIDs={participants?.map((p) => p.user_id)}
          zone={trip.time_zone}
          ledger={ledger}
          pending={api.pending || current.role === "viewer"}
          error={api.error}
          onDirty={() => api.reset()}
          onCancel={close}
          onSave={async (input) => {
            const value = input as TransactionInput;
            if (
              current.role === "viewer" ||
              current.user_id !== value.to_user_id
            )
              throw new ApiError(
                403,
                "Only the recipient can confirm money received.",
              );
            const saved = await api.saveSettlement(
              {
                payment_id: value.payment_id,
                loan_id: value.loan_id,
                from_user_id: value.from_user_id!,
                to_user_id: value.to_user_id!,
                currency: value.currency,
                amount_minor: value.amount_minor,
                paid_on: value.paid_on,
              },
              undefined,
              receiptKey.current,
            );
            if (!saved) return;
            setDebt(null);
          }}
        />
      )}
    </TripDialog>
  );
}
