"use client";

import { Button } from "@/components/ui/button";

export function SplitStatusFooter({
  unassigned,
  assigned,
  total,
  canBalance,
  untouched,
  remaining,
  busy,
  money,
  balanceShares,
}: {
  unassigned: bigint;
  assigned: bigint;
  total: string;
  canBalance: boolean;
  untouched: number[];
  remaining: bigint;
  busy: boolean;
  money: (value: string | bigint) => string;
  balanceShares: () => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-[var(--trip-sand)] p-3 text-[13px] leading-[21px] font-semibold [overflow-wrap:anywhere]"
      data-balanced={unassigned === 0n}
    >
      <p aria-live="polite">
        {money(assigned)} of {money(total)} assigned ·{" "}
        {unassigned === 0n
          ? "Matches the total"
          : unassigned > 0n
            ? `${money(unassigned)} left to assign`
            : `${money(-unassigned)} over`}
      </p>
      {canBalance && (
        <Button
          type="button"
          variant="link"
          disabled={busy}
          onClick={balanceShares}
        >
          {untouched.length === 1
            ? `Give the remaining ${money(remaining)} to the other person`
            : `Split the remaining ${money(remaining)} between the other ${untouched.length}`}
        </Button>
      )}
    </div>
  );
}
