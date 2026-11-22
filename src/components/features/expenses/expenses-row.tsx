"use client";

import { CaretRightIcon } from "@phosphor-icons/react";
import type { Expense } from "@/lib/expenses";
import { plural } from "@/lib/utils";

/**
 * Figma "Expenses row" in activity details: one tappable card with the count
 * (and how many came from Prep), the total and your share, opening the list.
 */
export function ExpensesRow({
  costs,
  share,
  money,
  onOpen,
}: {
  costs: Expense[];
  share: (code: string) => bigint;
  money: (amount: string | bigint, currency: string) => string;
  onOpen: () => void;
}) {
  const codes = [...new Set(costs.map((cost) => cost.currency))];
  const fromPrep = costs.filter((cost) => cost.prep_task_id).length;
  const count = costs.length
    ? [plural(costs.length, "expense"), fromPrep ? `${fromPrep} from Prep` : ""]
        .filter(Boolean)
        .join(" · ")
    : "No expenses yet";
  return (
    <button
      type="button"
      data-finance-link="details"
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card py-3.5 pr-3 pl-4 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onOpen}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-[22px] font-semibold">
          Expenses
        </span>
        <span className="block text-[13px] leading-5 text-muted-foreground">
          {count}
        </span>
      </span>
      {codes.length > 0 && (
        <span className="min-w-0 shrink text-right [overflow-wrap:anywhere]">
          {codes.map((code) => {
            const total = costs
              .filter((cost) => cost.currency === code)
              .reduce((sum, cost) => sum + BigInt(cost.amount_minor), 0n);
            return (
              <span key={code} className="block">
                <span className="block text-base leading-[22px] font-semibold tabular-nums">
                  {money(total, code)} total
                </span>
                <span className="block text-[13px] leading-5 text-muted-foreground tabular-nums">
                  Your share {money(share(code), code)}
                </span>
              </span>
            );
          })}
        </span>
      )}
      <CaretRightIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    </button>
  );
}
