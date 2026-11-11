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
    <div className="trip-balance">
      {title}
      {codes.map((code) => {
        const totals = personalTotals(ledger, me, code);
        return (
          <div key={code} className="trip-balance-currency">
            {codes.length > 1 && <p className="trip-balance-code">{code}</p>}
            <dl className="trip-balance-totals">
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
