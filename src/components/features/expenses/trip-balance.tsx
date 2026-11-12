"use client";

import type { ReactNode } from "react";
import { personalTotals } from "@/lib/activity-expenses";
import type { ActivityLedger, Currency } from "@/lib/expenses";
import { moneyIn } from "@/lib/money";

export function TripBalance({
  title,
  ledger,
  me,
  currencies,
}: {
  title: ReactNode;
  ledger: ActivityLedger;
  me: number;
  currencies: Currency[];
}) {
  const codes = [
    ...new Set([
      ...ledger.expenses
        .filter((e) => e.shares.some((s) => s.user_id === me))
        .map((e) => e.currency),
      ...[...ledger.debts, ...ledger.loans, ...ledger.settlements]
        .filter((d) => d.from_user_id === me || d.to_user_id === me)
        .map((d) => d.currency),
    ]),
  ];
  if (!codes.length) return title;
  const money = moneyIn(currencies);
  return (
    <div className="trip-balance [&>.trip-balance-title]:[padding-bottom:1rem] [&>.trip-balance-title]:[border-bottom:1px_solid_color-mix(in_srgb,_var(--foreground)_12%,_transparent)] [&]:[display:grid] [&]:[gap:1.25rem] [&]:[padding:1.5rem] [&]:[border-radius:1rem] [&]:[background:var(--trip-sea)] max-md:[&]:[padding:1rem]">
      {title}
      {codes.map((code) => {
        const totals = personalTotals(ledger, me, code);
        return (
          <div
            key={code}
            className="trip-balance-currency [display:grid] [gap:0.75rem]"
          >
            {codes.length > 1 && (
              <p className="trip-balance-code [font-size:0.75rem] [font-weight:700] [letter-spacing:0.08em] [text-transform:uppercase] [color:var(--muted-foreground)]">
                {code}
              </p>
            )}
            <dl className="trip-balance-totals [display:flex] [flex-wrap:wrap] [gap:0.75rem_1.75rem] [&_dt]:[font-size:0.8125rem] [&_dt]:[font-weight:500] [&_dt]:[color:color-mix(in_srgb,_var(--foreground)_78%,_var(--trip-sea))] [&_dd]:[margin-top:0.25rem] [&_dd]:[font-size:1.625rem] [&_dd]:[line-height:2rem] [&_dd]:[font-weight:700] [&_dd]:[letter-spacing:-0.02em] [&_dd]:[font-variant-numeric:tabular-nums] [&_.trip-balance-overall]:[margin-left:auto] [&_.trip-balance-overall]:[text-align:right] [&_.trip-balance-overall_dd]:[color:var(--muted-foreground)] max-md:[&_>_[data-tone]]:[flex:1] max-md:[&_.trip-balance-overall]:[flex-basis:100%] max-md:[&_.trip-balance-overall]:[margin-left:0] max-md:[&_.trip-balance-overall]:[padding-top:0.75rem] max-md:[&_.trip-balance-overall]:[border-top:1px_solid_color-mix(in_oklab,_var(--foreground)_10%,_transparent)] max-md:[&_.trip-balance-overall]:[text-align:left] [&_[data-tone]_dd]:[color:var(--foreground)]">
              <div data-tone="owe">
                <dt>You owe</dt>
                <dd>{money(totals.remaining, code)}</dd>
              </div>
              <div data-tone="owed">
                <dt>You&rsquo;re owed</dt>
                <dd>{money(totals.owed, code)}</dd>
              </div>
              <div className="trip-balance-overall">
                <dt>Your total share</dt>
                <dd>{money(totals.cost, code)}</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}
