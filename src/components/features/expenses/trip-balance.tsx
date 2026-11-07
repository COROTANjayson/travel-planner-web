"use client";

import { personalTotals } from "@/lib/activity-expenses";
import type { ActivityLedger, Currency } from "@/lib/expenses";
import { moneyIn } from "@/lib/money";

export function TripBalance({
  ledger,
  me,
  currencies,
}: {
  ledger: ActivityLedger;
  me: number;
  currencies: Currency[];
}) {
  const codes = [
    ...new Set([
      ...ledger.expenses.map((e) => e.currency),
      ...ledger.debts
        .filter((d) => d.from_user_id === me || d.to_user_id === me)
        .map((d) => d.currency),
    ]),
  ];
  if (!codes.length)
    return (
      <p className="text-muted-foreground">
        No expenses yet. Add costs from an activity in the itinerary.
      </p>
    );
  const money = moneyIn(currencies);
  return (
    <section aria-label="Trip balance" className="trip-balance">
      {codes.map((code) => {
        const spent = ledger.expenses
          .filter((e) => e.currency === code)
          .reduce((n, e) => n + BigInt(e.amount_minor), 0n);
        const totals = personalTotals(ledger, me, code);
        return (
          <div key={code} className="trip-balance-currency">
            {codes.length > 1 && <p className="trip-balance-code">{code}</p>}
            <dl className="trip-balance-totals">
              <div className="trip-balance-overall">
                <dt>Overall expenses</dt>
                <dd>{money(spent, code)}</dd>
              </div>
              <div data-tone="owe">
                <dt>Balance</dt>
                <dd>{money(totals.remaining, code)}</dd>
              </div>
              <div data-tone="owed">
                <dt>To receive</dt>
                <dd>{money(totals.owed, code)}</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </section>
  );
}
