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
      className="expense-split-status [display:grid] [gap:4px] [margin-bottom:12px] [padding:12px_16px] [border:1px_solid_var(--border)] [border-radius:16px] [background:var(--secondary)] [overflow-wrap:anywhere] [&_.figma-summary-value]:[font-size:18px] [&_.figma-summary-value]:[line-height:24px] [&[data-balanced='false']]:[background:var(--trip-sand)] [&_p:not(.figma-summary-value)]:[font-size:14px] [&_p:not(.figma-summary-value)]:[line-height:20px]"
      data-balanced={unassigned === 0n}
    >
      <div aria-live="polite">
        <p className="figma-summary-value [font-weight:700] [font-size:22px] [line-height:30px]">
          {unassigned === 0n
            ? "Matches the total"
            : unassigned > 0n
              ? `${money(unassigned)} left to assign`
              : `${money(-unassigned)} over`}
        </p>
        <p>
          {money(assigned)} of {money(total)} assigned
        </p>
      </div>
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
