"use client";

import { rowDetail, rowTitle } from "@/components/features/expenses/card-row";
import { CaretRightIcon } from "@phosphor-icons/react";
import type { Screen } from "@/components/features/expenses/drawers/payment-workspace/expense-payment-workspace";
import type { Expense, PaymentStatus } from "@/lib/expenses";

// Mobile puts the name above its amounts; wider screens keep aligned columns.
const columns =
  "sm:grid sm:grid-cols-[minmax(0,1fr)_repeat(3,72px)_14px] sm:items-center sm:gap-3";

export function PaymentListScreen({
  data,
  cost,
  money,
  name,
  canReserve,
  setScreen,
}: {
  data: PaymentStatus;
  cost: Expense;
  money: (value: string) => string;
  name: (id: number) => string;
  canReserve: boolean;
  setScreen: (screen: Screen) => void;
}) {
  const remaining = BigInt(data.business_remaining_minor);
  const BusinessCard = canReserve ? "button" : "div";
  return (
    <div className="expense-payment-list grid gap-4 sm:gap-5">
      {data.members.some((m) => BigInt(m.credit_minor) > 0n) && (
        <p className="text-sm text-primary">
          Some contributions exceed the updated shares. Review member credits
          before recording more payments.
        </p>
      )}
      <div className="figma-payment-table divide-y overflow-hidden rounded-[16px] border bg-card tabular-nums">
        <div
          aria-hidden="true"
          className={`${columns} hidden px-4 py-3 text-xs leading-5 font-medium text-muted-foreground [&>:not(:first-child)]:text-right`}
        >
          <span>Member</span>
          <span>Share</span>
          <span>Paid</span>
          <span>Left</span>
          <span />
        </div>
        {data.members.map((row) => (
          <button
            key={row.user_id}
            type="button"
            className={`figma-payment-row ${columns} relative block min-h-11 w-full cursor-pointer p-4 text-left text-sm leading-5 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset`}
            aria-label={`View ${name(row.user_id)}’s ${cost.description} payment`}
            onClick={() => setScreen(row.user_id)}
          >
            <span className="block min-w-0 pr-6 text-base leading-6 font-medium [overflow-wrap:anywhere] sm:pr-0">
              {name(row.user_id)}
            </span>
            <span className="mt-3 grid grid-cols-[repeat(3,minmax(max-content,1fr))] gap-3 overflow-x-auto sm:contents">
              {[
                ["Share", row.share_minor],
                ["Paid", row.paid_minor],
                ["Left", row.remaining_minor],
              ].map(([label, value]) => (
                <span key={label} className="grid gap-1 sm:text-right">
                  <span className="text-xs text-muted-foreground sm:sr-only">
                    {label}
                  </span>
                  <span className="whitespace-nowrap sm:overflow-x-auto">
                    {money(value)}
                  </span>
                </span>
              ))}
            </span>
            <CaretRightIcon
              aria-hidden="true"
              className="absolute top-5 right-4 size-3.5 shrink-0 text-muted-foreground sm:static"
            />
          </button>
        ))}
      </div>
      <BusinessCard
        {...(canReserve
          ? {
              type: "button" as const,
              "aria-label": `Record reservation for ${cost.description}`,
              onClick: () => setScreen("reservation"),
            }
          : {})}
        className={`flex min-h-11 w-full items-center gap-3 rounded-[16px] border bg-card px-3.5 py-3 text-left [overflow-wrap:anywhere] sm:p-4 ${canReserve ? "cursor-pointer hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring" : ""}`}
      >
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className={rowTitle}>Paid to the business</span>
          <span className={rowDetail}>
            {remaining >= 0n
              ? `Remaining ${money(data.business_remaining_minor)}`
              : `${money((-remaining).toString())} credit to review`}
          </span>
        </span>
        <span className={`shrink-0 tabular-nums ${rowTitle}`}>
          {money(data.business_paid_minor)}
        </span>
        {canReserve && (
          <CaretRightIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        )}
      </BusinessCard>
    </div>
  );
}
