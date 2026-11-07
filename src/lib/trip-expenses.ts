import { memberPaymentState } from "./activity-expenses";
import type { ActivityLedger, Expense } from "./expenses";

export const categoryOf = (
  expense: Pick<Expense, "activity_id">,
  activities: { id: number; category: string }[],
) => activities.find((a) => a.id === expense.activity_id)?.category || "Other";

export interface MyEntry {
  key: string;
  date: string;
  title: string;
  detail: string;
  currency: string;
  amount_minor: string;
  status: "owe" | "owed" | "settled";
  status_label: string;
  status_amount?: string;
  activity_id?: number;
}

// Every money record that touches the signed-in person, one row each, newest first.
export function myEntries(
  ledger: ActivityLedger,
  activities: { id: number; title: string }[],
  me: number,
  name: (id: number) => string,
): MyEntry[] {
  const place = (x: { activity_id?: number; activity_name?: string }) =>
    activities.find((a) => a.id === x.activity_id)?.title ??
    (x.activity_name ? `${x.activity_name} (removed)` : "Unassigned");
  const detail = (...parts: (string | undefined)[]) =>
    parts.filter((p, i, all) => p && all.indexOf(p) === i).join(" · ");
  const expenses = ledger.expenses
    .filter((e) => e.shares.some((s) => s.user_id === me))
    .map<MyEntry>((e) => {
      const state = memberPaymentState(e, ledger, me);
      return {
        key: `expense-${e.id}`,
        date: e.incurred_on,
        title: e.description,
        detail: detail(
          place(e),
          e.payer_user_id ? `Paid by ${name(e.payer_user_id)}` : "Business",
        ),
        currency: e.currency,
        amount_minor: String(state.share),
        activity_id: e.activity_id,
        ...(state.credit > 0n
          ? {
              status: "owed" as const,
              status_label: "credit for review",
              status_amount: String(state.credit),
            }
          : state.remaining > 0n
            ? {
                status: "owe" as const,
                status_label: "you owe",
                status_amount: String(state.remaining),
              }
            : { status: "settled" as const, status_label: "paid" }),
      };
    });
  const owedToMe = ledger.debts
    .filter(
      (d) => d.payment_id && d.to_user_id === me && BigInt(d.amount_minor) > 0n,
    )
    .map<MyEntry>((d) => {
      const expense = ledger.expenses.find((e) =>
        ledger.payments.some(
          (p) => p.id === d.payment_id && p.expense_id === e.id,
        ),
      );
      return {
        key: `owed-${d.payment_id}-${d.from_user_id}`,
        date: expense?.incurred_on ?? "",
        title: `${name(d.from_user_id)} owes you`,
        detail: detail(place(d), d.description),
        currency: d.currency,
        amount_minor: d.amount_minor,
        activity_id: d.activity_id,
        status: "owed",
        status_label: "owes you",
      };
    });
  const loans = ledger.loans
    .filter((l) => l.from_user_id === me || l.to_user_id === me)
    .map<MyEntry>((l) => {
      const lent = l.from_user_id === me;
      const left = ledger.debts
        .filter((d) => d.loan_id === l.id && BigInt(d.amount_minor) > 0n)
        .reduce((n, d) => n + BigInt(d.amount_minor), 0n);
      return {
        key: `loan-${l.id}`,
        date: l.paid_on,
        title: lent
          ? `You lent ${name(l.to_user_id)}`
          : `${name(l.from_user_id)} lent you`,
        detail: detail(place(l), l.description),
        currency: l.currency,
        amount_minor: l.amount_minor,
        activity_id: l.activity_id,
        ...(left > 0n
          ? {
              status: lent ? ("owed" as const) : ("owe" as const),
              status_label: lent ? "left to repay you" : "you owe",
              status_amount: String(left),
            }
          : { status: "settled" as const, status_label: "repaid" }),
      };
    });
  const settlements = ledger.settlements
    .filter((s) => s.from_user_id === me || s.to_user_id === me)
    .map<MyEntry>((s) => {
      const payment = ledger.payments.find((p) => p.id === s.payment_id);
      const source =
        ledger.expenses.find((e) => e.id === payment?.expense_id) ??
        ledger.loans.find((l) => l.id === s.loan_id);
      return {
        key: `settlement-${s.id}`,
        date: s.paid_on,
        title:
          s.from_user_id === me
            ? `You paid ${name(s.to_user_id)}`
            : `${name(s.from_user_id)} paid you`,
        detail: detail(
          source ? place(source) : "Unassigned",
          source?.description,
          s.loan_id ? "Loan repayment" : "Reimbursement",
          s.correction_reason,
        ),
        currency: s.currency,
        amount_minor: s.amount_minor,
        activity_id: source?.activity_id,
        status: "settled",
        status_label: s.from_user_id === me ? "you paid" : "received",
      };
    });
  return [...expenses, ...owedToMe, ...loans, ...settlements].sort(
    (a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key),
  );
}
