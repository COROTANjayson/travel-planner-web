"use client";

import type { ActivityExpenseView } from "@/components/features/expenses/activity-expenses";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import type { ActivityLedger } from "@/lib/expenses";

export function BorrowListLink({
  ownLoans,
  money,
  onViewChange,
}: {
  ownLoans: ActivityLedger["loans"];
  money: (amount: string | bigint, currency: string) => string;
  onViewChange?: (view: ActivityExpenseView) => void;
}) {
  return (
    <Button
      variant="ghost"
      data-finance-link="loans"
      className="activity-borrow-link grid h-auto min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-[6px] border-t-border px-3 py-3.5 text-left whitespace-normal hover:bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] hover:text-foreground active:not-focus-visible:scale-100 [&>svg]:text-muted-foreground"
      onClick={() => onViewChange?.("loans")}
    >
      <span>Borrow list</span>
      <span className="activity-borrow-summary [min-width:0] [text-align:right] [overflow-wrap:anywhere] [font-size:13px] [line-height:20px] text-sm text-muted-foreground">
        {ownLoans.length} {ownLoans.length === 1 ? "loan" : "loans"}
        {[...new Set(ownLoans.map((l) => l.currency))]
          .map(
            (code) =>
              ` · ${money(
                ownLoans
                  .filter((l) => l.currency === code)
                  .reduce((sum, l) => sum + BigInt(l.amount_minor), 0n),
                code,
              )} total`,
          )
          .join("")}
      </span>
      <ChevronRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
    </Button>
  );
}
