"use client";

import type { ExpenseEditor } from "@/components/features/expenses/activity-expense-form/activity-expense-form";
import { Button } from "@/components/ui/button";
import type {
  Debt,
  FinancialRecord,
  LedgerKind,
  Settlement,
  useExpensesApi,
} from "@/lib/expenses";

export function ReceiptRows({
  receipts,
  name,
  money,
  showHistory,
  canCorrect,
  debtFor,
  open,
  reverse,
  api,
}: {
  receipts: Settlement[];
  name: (id: number) => string;
  money: (amount: string | bigint, currency: string) => string;
  showHistory: (id: number) => Promise<void>;
  canCorrect: (receipt: Settlement) => boolean;
  debtFor: (receipt: Settlement) => Debt | undefined;
  open: (next: ExpenseEditor) => void;
  reverse: (kind: LedgerKind, record: FinancialRecord) => Promise<void>;
  api: Pick<ReturnType<typeof useExpensesApi>, "pending">;
}) {
  return (
    <>
      {receipts.map((s) => (
        <div key={`s${s.id}`}>
          <p>
            {name(s.to_user_id)} received {money(s.amount_minor, s.currency)}{" "}
            from {name(s.from_user_id)} · {s.paid_on}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => void showHistory(s.id)}>
              Receipt history
            </Button>
            {canCorrect(s) && (
              <>
                <Button
                  variant="ghost"
                  onClick={() =>
                    open({ type: "repayment", receipt: s, debt: debtFor(s) })
                  }
                >
                  Correct receipt
                </Button>
                <Button
                  variant="ghost"
                  disabled={api.pending}
                  onClick={() => void reverse("settlements", s)}
                >
                  Reverse receipt
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
