"use client";

import type { ComponentProps, Dispatch, SetStateAction } from "react";
import {
  ActivityExpenseForm,
  type ExpenseEditor,
} from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import type { useExpensesApi } from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";
import type { Trip } from "@/lib/trips";

type FormProps = ComponentProps<typeof ActivityExpenseForm>;

export function ExpenseEditorDialog({
  editing,
  editor,
  setEditor,
  hasActivity,
  activityID,
  activityTitle,
  options,
  people,
  participants,
  current,
  trip,
  data,
  currencies,
  api,
  writable,
  revision,
  setRevision,
  localError,
  setLocalError,
  save,
  close,
  finalFocus,
}: {
  editing: ExpenseEditor | null;
  editor: ExpenseEditor | null;
  setEditor: (editor: ExpenseEditor | null) => void;
  hasActivity: boolean;
  activityID: string;
  activityTitle: string;
  options: FormProps["activities"];
  people: FormProps["people"];
  participants?: Participant[];
  current?: Participant;
  trip: Trip;
  data?: FormProps["ledger"];
  currencies?: FormProps["currencies"];
  api: Pick<
    ReturnType<typeof useExpensesApi>,
    "pending" | "error" | "get" | "refresh" | "reset"
  >;
  writable: boolean;
  revision: number;
  setRevision: Dispatch<SetStateAction<number>>;
  localError: Error | null;
  setLocalError: (error: Error | null) => void;
  save: FormProps["onSave"];
  close: () => void;
  finalFocus: ComponentProps<typeof TripDialog>["finalFocus"];
}) {
  return (
    <TripDialog
      className="expense-editor-dialog"
      backdropClassName="bg-black/60"
      open={!!editing && (editing.type !== "cost" || !hasActivity)}
      title={
        editing?.type === "cost"
          ? editing.cost
            ? "Edit expense"
            : "Add expense"
          : editing?.type === "loan"
            ? "Record money lent"
            : editing?.type === "payment"
              ? "Record business payment"
              : editing?.receipt
                ? "Correct receipt"
                : editing?.debt?.loan_id
                  ? "Record repayment"
                  : "Mark as paid"
      }
      description={activityTitle}
      busy={api.pending}
      disablePointerDismissal
      finalFocus={finalFocus}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      {editing &&
        (editing.type !== "cost" || !hasActivity) &&
        data &&
        currencies &&
        current && (
          <>
            <ActivityExpenseForm
              key={`${revision}-${editing.type}-${editing.cost?.id ?? "new"}-${editing.memberID ?? ""}-${editing.payment?.id ?? ""}-${editing.receipt?.id ?? ""}-${editing.debt?.payment_id ?? editing.debt?.loan_id ?? ""}-${editing.debt?.from_user_id ?? ""}`}
              editor={editing}
              activityID={activityID}
              activities={options}
              people={people}
              currencies={currencies}
              userID={current.user_id}
              currentUserIDs={participants?.map((p) => p.user_id)}
              zone={trip.time_zone}
              ledger={data}
              pending={api.pending || !writable}
              error={api.error}
              onDirty={() => {
                if (!editor) setEditor(editing);
              }}
              onSave={save}
              onCancel={close}
            />
            {localError && <TripError error={localError} />}
            {api.error instanceof ApiError && api.error.status === 409 && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    if (editing.cost) {
                      const latest = await api.get("expenses", editing.cost.id);
                      setEditor({
                        ...editing,
                        cost: latest as typeof editing.cost,
                      });
                    }
                    if (editing.payment) {
                      const latest = await api.get(
                        "expense_payments",
                        editing.payment.id,
                      );
                      setEditor({
                        ...editing,
                        payment: latest as typeof editing.payment,
                      });
                    }
                    if (editing.receipt) {
                      const latest = await api.get(
                        "settlements",
                        editing.receipt.id,
                      );
                      setEditor({
                        ...editing,
                        receipt: latest as typeof editing.receipt,
                      });
                    }
                    await api.refresh();
                    setRevision((n) => n + 1);
                    api.reset();
                  } catch (cause) {
                    setLocalError(cause as Error);
                  }
                }}
              >
                Reload latest record
              </Button>
            )}
          </>
        )}
    </TripDialog>
  );
}
