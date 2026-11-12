"use client";

import type { ComponentProps, RefObject } from "react";
import { ActivityExpenseForm } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { repaymentSlots } from "@/components/shared/trip-dialog-variants";
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
          ? "activity-details-dialog expense-flow-dialog repayment-dialog [&_[data-slot='input']]:min-h-12 [&_[data-slot='input']]:rounded-[0.875rem] [&_[data-slot='select-trigger']]:min-h-12 [&_[data-slot='select-trigger']]:rounded-[0.875rem] [&_.ledger-form_button[type='submit']]:mx-auto [&_.ledger-form_button[type='submit']]:max-w-lg max-md:[&_.expense-form-actions]:-mx-4 max-md:[&_.expense-form-actions]:px-4 max-md:[&_.expense-form-actions]:pb-[max(16px,env(safe-area-inset-bottom,0px))]"
          : "expense-editor-dialog"
      }
      variant={backLabel ? "expense" : undefined}
      navClassName={backLabel ? repaymentSlots.nav : undefined}
      headerClassName={backLabel ? repaymentSlots.header : undefined}
      bodyClassName={backLabel ? repaymentSlots.body : undefined}
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
