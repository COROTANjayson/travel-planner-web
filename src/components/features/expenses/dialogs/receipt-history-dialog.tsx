"use client";

import { TripDialog } from "@/components/shared/trip-dialog";
import { TripError } from "@/components/shared/trip-states";
import type { ReceiptHistory } from "@/lib/expenses";

export function ReceiptHistoryDialog({
  historyID,
  setHistoryID,
  history,
  historyError,
  showHistory,
  name,
  money,
}: {
  historyID: number | null;
  setHistoryID: (id: number | null) => void;
  history: ReceiptHistory[] | null;
  historyError: Error | null;
  showHistory: (id: number) => Promise<void>;
  name: (id: number) => string;
  money: (amount: string | bigint, currency: string) => string;
}) {
  return (
    <TripDialog
      open={historyID !== null}
      title="Receipt history"
      description="Who recorded or corrected this receipt"
      onOpenChange={(open) => {
        if (!open) setHistoryID(null);
      }}
    >
      <div className="space-y-4">
        {historyError ? (
          <TripError
            error={historyError}
            retry={() => void showHistory(historyID!)}
          />
        ) : history === null ? (
          <p role="status">Loading receipt history…</p>
        ) : history.length ? (
          history.map((h) => (
            <div key={h.id} className="border-b pb-3 text-sm">
              <p>
                {h.action} by {name(h.actor_user_id)} ·{" "}
                {new Date(h.created_at).toLocaleString()}
              </p>
              {h.reason && <p>{h.reason}</p>}
              <p>
                {h.before
                  ? money(h.before.amount_minor, h.before.currency)
                  : "No previous receipt"}{" "}
                →{" "}
                {h.after
                  ? money(h.after.amount_minor, h.after.currency)
                  : "Reversed"}
              </p>
            </div>
          ))
        ) : (
          <p>No earlier changes recorded for this historical receipt.</p>
        )}
      </div>
    </TripDialog>
  );
}
