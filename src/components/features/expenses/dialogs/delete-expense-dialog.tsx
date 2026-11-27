"use client";

import { useRef, useState, type ComponentProps } from "react";
import { TripError } from "@/components/shared/trip-states";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Expense } from "@/lib/expenses";

export function DeleteExpenseDialog({
  cost,
  hasPayments,
  isEditor,
  available,
  pending,
  money,
  onDelete,
  onClose,
  finalFocus,
}: {
  cost: Expense;
  hasPayments: boolean;
  isEditor: boolean;
  available: boolean;
  pending: boolean;
  money: (amount: string | bigint, currency: string) => string;
  onDelete: () => Promise<void>;
  onClose: () => void;
  finalFocus: ComponentProps<typeof AlertDialogContent>["finalFocus"];
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  const blocked = !isEditor || !available;
  const explanation = !available
    ? "This expense is no longer available. Refresh the list to see the latest expenses."
    : !isEditor
      ? "Only trip owners and editors can delete expenses."
      : hasPayments
        ? "This removes the expense, its recorded payments and linked reimbursements from the trip’s balances. This cannot be undone."
        : "This removes the expense and its planned shares for everyone on this trip. This cannot be undone.";
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending && !busy.current) onClose();
      }}
    >
      <AlertDialogContent
        tripSheet
        className="p-0! pb-[env(safe-area-inset-bottom)]!"
        initialFocus={cancel}
        finalFocus={finalFocus}
        aria-busy={pending}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocked ? "Expense can’t be deleted" : "Delete this expense?"}
          </AlertDialogTitle>
          <AlertDialogDescription>{explanation}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 px-6 pb-5 [overflow-wrap:anywhere]">
          <p className="font-semibold">{cost.description}</p>
          <p className="text-sm text-muted-foreground">
            Total {money(cost.amount_minor, cost.currency)} ·{" "}
            {cost.shares.length}{" "}
            {cost.shares.length === 1 ? "person" : "people"} ·{" "}
            {hasPayments ? "Payments recorded" : "No payments recorded"}
          </p>
          {error && <TripError error={error} />}
        </div>
        <AlertDialogFooter className="m-0! px-6! py-4!">
          <AlertDialogCancel
            ref={cancel}
            disabled={pending}
            className="min-h-11"
          >
            {blocked ? "Close" : "Cancel"}
          </AlertDialogCancel>
          {!blocked && (
            <Button
              variant="destructive"
              disabled={pending}
              className="min-h-11"
              onClick={async () => {
                if (pending || busy.current) return;
                busy.current = true;
                setError(null);
                try {
                  await onDelete();
                } catch (cause) {
                  setError(cause as Error);
                } finally {
                  busy.current = false;
                }
              }}
            >
              {pending ? "Deleting…" : error ? "Try again" : "Delete expense"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
