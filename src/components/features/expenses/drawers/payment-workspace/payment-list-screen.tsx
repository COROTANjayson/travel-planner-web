"use client";

import { ChevronRight } from "lucide-react";
import type { Screen } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { Button } from "@/components/ui/button";
import type { Expense, PaymentStatus } from "@/lib/expenses";

export function PaymentListScreen({
  data,
  cost,
  editor,
  money,
  name,
  setScreen,
}: {
  data: PaymentStatus;
  cost: Expense;
  editor: boolean;
  money: (value: string) => string;
  name: (id: number) => string;
  setScreen: (screen: Screen) => void;
}) {
  return (
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
            onClick={() => setScreen({ type: "payment", reservation: true })}
          >
            Record reservation
          </Button>
        )}
      {data.members.some((m) => BigInt(m.credit_minor) > 0n) && (
        <p className="text-sm text-primary">
          Some contributions exceed the updated shares. Review member credits
          before recording more payments.
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
  );
}
