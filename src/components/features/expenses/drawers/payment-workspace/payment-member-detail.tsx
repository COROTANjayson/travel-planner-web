"use client";

import type { RefObject } from "react";
import type { Screen } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import { Button } from "@/components/ui/button";
import type {
  Debt,
  Expense,
  PaymentStatus,
  useExpensesApi,
} from "@/lib/expenses";
import type { Participant } from "@/lib/memberships";

export function PaymentMemberDetail({
  data,
  member,
  cost,
  current,
  editor,
  api,
  receive,
  memberStatusRef,
  money,
  name,
  setScreen,
}: {
  data: PaymentStatus;
  member: PaymentStatus["members"][number];
  cost: Expense;
  current?: Participant;
  editor: boolean;
  api: Pick<ReturnType<typeof useExpensesApi>, "pending">;
  receive: (debt: Debt) => Promise<void>;
  memberStatusRef: RefObject<HTMLDivElement | null>;
  money: (value: string) => string;
  name: (id: number) => string;
  setScreen: (screen: Screen) => void;
}) {
  return (
    <div className="expense-member-detail [padding-top:12px] [&>.figma-money-summary]:[min-height:108px] [&>.figma-money-summary]:[margin-bottom:38px] [&>.figma-money-summary]:[gap:12px] [&>.figma-member-line]:[font-size:18px] [&>.figma-member-line]:[line-height:26px] [&_>_.figma-member-line]:[display:grid] [&_>_.figma-member-line]:[grid-template-columns:minmax(0,_1fr)_94px]">
      <div
        ref={memberStatusRef}
        tabIndex={-1}
        className="figma-money-summary [&>p:not(.figma-summary-value)]:text-sm [&>p:not(.figma-summary-value)]:leading-[1.7] [display:grid] [gap:1rem] [background:var(--secondary)] [overflow-wrap:anywhere] [border:1px_solid_var(--border)] [padding:20px] [border-radius:18px] [&:has(>_.figma-summary-action)]:[display:flex] [&:has(>_.figma-summary-action)]:[flex-wrap:wrap] [&:has(>_.figma-summary-action)]:[align-items:center] [&:has(>_.figma-summary-action)_>_.figma-summary-value]:[flex-basis:100%] [&:has(>_.figma-summary-action)_>_p:not(.figma-summary-value)]:[flex:1_1_8rem]"
        aria-live="polite"
      >
        <p className="figma-summary-value [font-weight:700] [font-size:22px] [line-height:30px]">
          {BigInt(member.remaining_minor) > 0n
            ? `${money(member.remaining_minor)} left to pay`
            : "Share fully paid"}
        </p>
        <p>
          {BigInt(member.business_remaining_minor) > 0n
            ? `${money(member.business_remaining_minor)} to ${cost.description}`
            : member.reimbursements
                .filter((d) => BigInt(d.amount_minor) > 0n)
                .map(
                  (d) => `To ${name(d.to_user_id)} · reservation reimbursement`,
                )
                .join(", ") || "All payments received"}
        </p>
      </div>
      <div className="figma-member-line [&>:last-child]:shrink-0 [&>:last-child]:tabular-nums [display:flex] [align-items:start] [justify-content:space-between] [gap:1rem] [overflow-wrap:anywhere]">
        <strong>Paid to {cost.description}</strong>
        <span>
          {money(
            data.payments
              .filter((p) => p.payer_user_id === member.user_id)
              .reduce((n, p) => n + BigInt(p.amount_minor), 0n)
              .toString(),
          )}
        </span>
      </div>
      {data.payments
        .filter((p) => p.payer_user_id === member.user_id)
        .map((p) => (
          <p
            className="member-paid-date [margin-top:12px] [font-size:14px] [line-height:22px] [color:var(--primary)]"
            key={p.id}
          >
            Paid ·{" "}
            {new Date(`${p.paid_on}T12:00:00Z`).toLocaleDateString(undefined, {
              timeZone: "UTC",
              month: "long",
              day: "numeric",
            })}
          </p>
        ))}
      {BigInt(member.business_remaining_minor) > 0n && (
        <div className="space-y-3">
          <div className="figma-member-line [&>:last-child]:shrink-0 [&>:last-child]:tabular-nums [display:flex] [align-items:start] [justify-content:space-between] [gap:1rem] [overflow-wrap:anywhere]">
            <strong>To {cost.description}</strong>
            <span>{money(member.business_remaining_minor)}</span>
          </div>
          {editor && (
            <Button
              className="w-full"
              onClick={() =>
                setScreen({ type: "payment", user: member.user_id })
              }
            >
              Update payment
            </Button>
          )}
        </div>
      )}
      {member.reimbursements.map((debt) => {
        const original =
          data.payments
            .find((p) => p.id === debt.payment_id)
            ?.allocations.find((a) => a.user_id === member.user_id)
            ?.amount_minor ?? debt.amount_minor;
        const receipts = data.receipts.filter(
          (s) =>
            s.payment_id === debt.payment_id &&
            s.from_user_id === member.user_id &&
            s.to_user_id === debt.to_user_id,
        );
        return (
          <section
            key={`${debt.payment_id}-${debt.to_user_id}`}
            className="figma-member-debt [display:grid] [border-top:1px_solid_var(--border)] [margin-top:28px] [padding-top:28px] [gap:12px] [&_.figma-member-line]:[font-size:18px] [&_.figma-member-line]:[line-height:26px] [&_>_[data-slot='button']]:[min-height:48px] [&_>_[data-slot='button']]:[margin-top:16px] [&_>_[data-slot='button']]:[padding-inline:16px] [&_>_[data-slot='button']]:[justify-content:flex-start] [&_>_[data-slot='button']]:[font-weight:700] [&_>_.figma-member-line]:[display:grid] [&_>_.figma-member-line]:[grid-template-columns:minmax(0,_1fr)_94px]"
          >
            <div className="figma-member-line [&>:last-child]:shrink-0 [&>:last-child]:tabular-nums [display:flex] [align-items:start] [justify-content:space-between] [gap:1rem] [overflow-wrap:anywhere]">
              <strong>To {name(debt.to_user_id)}</strong>
              {current?.role !== "viewer" &&
              current?.user_id === debt.to_user_id &&
              BigInt(debt.amount_minor) > 0n ? (
                <button
                  type="button"
                  className="repayment-amount [min-height:44px] [margin-block:-9px] [text-align:left] [cursor:pointer]"
                  aria-label="Record a partial repayment"
                  title="Record a partial repayment"
                  onClick={() =>
                    setScreen({
                      type: "payment",
                      user: member.user_id,
                      debt,
                    })
                  }
                >
                  {money(original)}
                </button>
              ) : (
                <span>{money(original)}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {BigInt(debt.amount_minor) > 0n
                ? receipts.length
                  ? `${money(debt.amount_minor)} remaining`
                  : "Not paid yet"
                : "Paid · received"}
            </p>
            {BigInt(debt.amount_minor) > 0n && (
              <>
                {current?.role !== "viewer" &&
                current?.user_id === debt.to_user_id ? (
                  <>
                    <Button
                      className="w-full"
                      disabled={api.pending}
                      onClick={() => void receive(debt)}
                    >
                      Mark {money(debt.amount_minor)} paid
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Only {name(debt.to_user_id)} can mark this reimbursement as
                    received.
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
      {BigInt(member.receivable_minor) > 0n && (
        <p className="text-sm text-primary">
          Owed back to {name(member.user_id)}: {money(member.receivable_minor)}
        </p>
      )}
      {BigInt(member.credit_minor) > 0n && (
        <p className="text-sm text-primary">
          Credit requiring correction: {money(member.credit_minor)}
        </p>
      )}
      <p className="member-payment-explanation [font-size:14px] [line-height:28px] [color:var(--muted-foreground)] [margin-top:72px] [max-width:31ch] [&_+_.member-payment-explanation]:[max-width:none] [&_+_.member-payment-explanation]:[margin-top:32px]">
        {BigInt(member.remaining_minor) > 0n
          ? `Once the ${money(member.remaining_minor)} is received, ${name(member.user_id)}’s whole ${money(member.share_minor)} share is marked Paid.`
          : "The whole share is marked Paid."}
      </p>
      <p className="member-payment-explanation [font-size:14px] [line-height:28px] [color:var(--muted-foreground)] [margin-top:72px] [max-width:31ch] [&_+_.member-payment-explanation]:[max-width:none] [&_+_.member-payment-explanation]:[margin-top:32px]">
        The share stays {money(member.share_minor)}. The reservation is already
        included in that amount.
      </p>
    </div>
  );
}
