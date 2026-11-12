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
    <div className="expense-payment-list [display:grid] [gap:28px] [padding-top:4px] [&>.figma-money-summary]:[min-height:113px] [&>.figma-money-summary]:[gap:12px]">
      <div className="figma-money-summary [&>p:not(.figma-summary-value)]:text-sm [&>p:not(.figma-summary-value)]:leading-[1.7] [display:grid] [gap:1rem] [background:var(--secondary)] [overflow-wrap:anywhere] [border:1px_solid_var(--border)] [padding:20px] [border-radius:18px] [&:has(>_.figma-summary-action)]:[display:flex] [&:has(>_.figma-summary-action)]:[flex-wrap:wrap] [&:has(>_.figma-summary-action)]:[align-items:center] [&:has(>_.figma-summary-action)_>_.figma-summary-value]:[flex-basis:100%] [&:has(>_.figma-summary-action)_>_p:not(.figma-summary-value)]:[flex:1_1_8rem]">
        <p className="figma-summary-value [font-weight:700] [font-size:22px] [line-height:30px]">
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
        <div className="figma-payment-columns [&>*]:min-w-0 [&>*]:[overflow-wrap:anywhere] [display:grid] [gap:0.5rem] [text-align:left] [font-variant-numeric:tabular-nums] [grid-template-columns:minmax(0,_1.8fr)_repeat(3,_minmax(0,_0.8fr))] figma-table-heading [color:var(--muted-foreground)] [font-size:14px] [line-height:20px] [padding-bottom:0] [&_>_:not(:first-child)]:[text-align:left]">
          <span>Member</span>
          <span>Share</span>
          <span>Paid</span>
          <span>Left</span>
        </div>
        {data.members.map((row) => (
          <button
            key={row.user_id}
            type="button"
            className="figma-payment-row focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ring [display:grid] [width:100%] [border-bottom:1px_solid_var(--border)] [cursor:pointer] [border-radius:0] [padding:24px_0_16px] [gap:8px] [min-height:90px] [padding-bottom:11px] [&:first-of-type_.figma-payment-note]:[color:var(--primary)] [&:hover]:[background:var(--secondary)]"
            aria-label={`View ${name(row.user_id)}’s ${cost.description} payment`}
            onClick={() => setScreen({ type: "member", user: row.user_id })}
          >
            <span className="figma-payment-columns [&>*]:min-w-0 [&>*]:[overflow-wrap:anywhere] [display:grid] [gap:0.5rem] [text-align:left] [font-variant-numeric:tabular-nums] [grid-template-columns:minmax(0,_1.8fr)_repeat(3,_minmax(0,_0.8fr))] [&_>_:not(:first-child)]:[text-align:left]">
              <strong>{name(row.user_id)}</strong>
              <span>{money(row.share_minor)}</span>
              <span>{money(row.paid_minor)}</span>
              <span>{money(row.remaining_minor)}</span>
            </span>
            <span className="payment-row-footer [display:flex] [flex-wrap:wrap] [gap:8px_16px] [align-items:center] [&_.figma-payment-note]:[flex:1] [&_.figma-payment-note]:[min-width:120px]">
              <span className="figma-payment-note [color:var(--muted-foreground)] [text-align:left] [overflow-wrap:anywhere] [font-size:12px] [line-height:20px]">
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
              <span className="payment-row-action [display:inline-flex] [gap:4px] [align-items:center] [font-size:12px] [font-weight:600] [color:var(--primary)] [&_svg]:[width:14px] [&_svg]:[height:14px]">
                View payment <ChevronRight aria-hidden="true" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
