"use client";

import type { ActivityExpenseView } from "@/components/features/expenses/activity-expenses";
import {
  CardRowContent,
  cardRowClass,
} from "@/components/features/expenses/card-row";
import { Button } from "@/components/ui/button";
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
  const lent = [...new Set(ownLoans.map((l) => l.currency))]
    .map(
      (code) =>
        ` · ${money(
          ownLoans
            .filter((l) => l.currency === code)
            .reduce((sum, l) => sum + BigInt(l.amount_minor), 0n),
          code,
        )} lent`,
    )
    .join("");
  return (
    <Button
      variant="ghost"
      data-finance-link="loans"
      className={cardRowClass}
      onClick={() => onViewChange?.("loans")}
    >
      <CardRowContent
        title="Borrow list"
        detail={`${ownLoans.length} ${ownLoans.length === 1 ? "loan" : "loans"}${lent}`}
      />
    </Button>
  );
}
