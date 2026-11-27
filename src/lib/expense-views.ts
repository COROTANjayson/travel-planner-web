import {
  memberPaymentState,
  personalTotals,
  uncovered,
} from "./activity-expenses";
import type { ActivityLedger, Expense, Loan } from "./expenses";
import type { PersonalExpense } from "./personal-expenses";

// The trip Expenses page: Group (the shared ledger's expenses) and Personal
// (private expenses plus money you lent). Amounts stay per currency throughout.

export const groupFilters = {
  all: "All",
  payment: "Needs payment",
  owe: "You owe",
  owed: "Owed to you",
  settled: "Settled",
} as const;
export type GroupFilter = keyof typeof groupFilters;

export const personalFilters = {
  all: "All",
  expenses: "Expenses",
  lent: "Lent",
} as const;
export type PersonalFilter = keyof typeof personalFilters;

export const categoryOf = (
  expense: Pick<Expense, "activity_id">,
  activities: { id: number; category: string }[],
) => activities.find((a) => a.id === expense.activity_id)?.category || "Other";

const pos = (v: bigint) => (v > 0n ? v : 0n);
const sum = (values: bigint[]) => values.reduce((n, v) => n + v, 0n);

/** Group figures cover expenses only, so loans never reach them. */
export const expensesOnly = (ledger: ActivityLedger): ActivityLedger => ({
  ...ledger,
  loans: [],
  debts: ledger.debts.filter((d) => d.payment_id),
});

export interface GroupRow {
  expense: Expense;
  total: bigint;
  share: bigint;
  /** Settled part of everyone's shares. */
  paid: bigint;
  /** The business is fully paid, so what remains is owed between people. */
  covered: boolean;
  people: number;
  paidPeople: number;
  payers: number[];
  noPayer: boolean;
  needsPayment: boolean;
  settled: boolean;
  owe: bigint;
  owed: bigint;
  /** The part of `owed` that is a credit to review rather than a reimbursement. */
  credit: bigint;
}

export function groupRow(
  expense: Expense,
  ledger: ActivityLedger,
  me: number,
): GroupRow {
  const payments = ledger.payments.filter((p) => p.expense_id === expense.id);
  // Shares can change after a payment, so someone it covered may no longer be
  // in the split and still owe or be owed.
  const ids = uncovered(expense, ledger).map((s) => s.user_id);
  const states = new Map(
    [...new Set([...ids, me])].map((id) => [
      id,
      memberPaymentState(expense, ledger, id),
    ]),
  );
  const members = ids.filter((id) => {
    const s = states.get(id)!;
    return (
      expense.shares.some((share) => share.user_id === id) ||
      s.remaining > 0n ||
      s.credit > 0n
    );
  });
  const of = (id: number) => states.get(id)!;
  const needsPayment = members.some((id) => of(id).remaining > 0n);
  const credited = members.some((id) => of(id).credit > 0n);
  const mine = of(me);
  return {
    expense,
    total: BigInt(expense.amount_minor),
    share: mine.share,
    paid: sum(members.map((id) => of(id).paid)),
    covered:
      payments.length > 0 && members.every((id) => of(id).business === 0n),
    people: members.length,
    paidPeople: members.filter(
      (id) => of(id).remaining === 0n && of(id).credit === 0n,
    ).length,
    payers: [...new Set(payments.map((p) => p.payer_user_id))],
    noPayer:
      needsPayment && !payments.length && !expense.planned_coverer_user_id,
    needsPayment,
    settled: !needsPayment && !credited,
    // A reimbursement corrected below what was received is owed back.
    owe:
      mine.remaining +
      sum(
        ledger.debts
          .filter(
            (d) =>
              d.to_user_id === me &&
              payments.some((p) => p.id === d.payment_id),
          )
          .map((d) => pos(-BigInt(d.amount_minor))),
      ),
    owed: mine.receivable + mine.credit,
    credit: mine.credit,
  };
}

/** Every live expense, newest first, including ones you have no share in. */
export const groupRows = (ledger: ActivityLedger, me: number) =>
  ledger.expenses
    .map((e) => groupRow(e, ledger, me))
    .sort(
      (a, b) =>
        b.expense.incurred_on.localeCompare(a.expense.incurred_on) ||
        b.expense.id - a.expense.id,
    );

export const matchesGroup = (filter: GroupFilter, row: GroupRow) =>
  filter === "all" ||
  (filter === "payment" && row.needsPayment) ||
  (filter === "owe" && row.owe > 0n) ||
  (filter === "owed" && row.owed > 0n) ||
  (filter === "settled" && row.settled);

export function groupTotals(ledger: ActivityLedger, me: number) {
  const shared = expensesOnly(ledger);
  return [...new Set(shared.expenses.map((e) => e.currency))].map(
    (currency) => {
      const mine = personalTotals(shared, me, currency);
      return {
        currency,
        total: sum(
          shared.expenses
            .filter((e) => e.currency === currency)
            .map((e) => BigInt(e.amount_minor)),
        ),
        share: mine.cost,
        owe: mine.remaining,
        owed: mine.owed,
      };
    },
  );
}

export type PersonalRow =
  | { kind: "expense"; date: string; record: PersonalExpense }
  | { kind: "loan"; date: string; record: Loan; left: bigint };

/** What is still to come back on a loan; negative means it was over-repaid. */
export const loanLeft = (ledger: ActivityLedger, loan: Loan) =>
  BigInt(
    ledger.debts.find((d) => d.loan_id === loan.id)?.amount_minor ??
      loan.amount_minor,
  );

export function personalRows(
  expenses: PersonalExpense[],
  ledger: ActivityLedger,
  me: number,
): PersonalRow[] {
  return [
    ...expenses.map((record) => ({
      kind: "expense" as const,
      date: record.incurred_on,
      record,
    })),
    ...ledger.loans
      .filter((l) => l.from_user_id === me)
      .map((record) => ({
        kind: "loan" as const,
        date: record.paid_on,
        record,
        left: loanLeft(ledger, record),
      })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.record.id - a.record.id);
}

export const matchesPersonal = (filter: PersonalFilter, row: PersonalRow) =>
  filter === "all" || (filter === "lent") === (row.kind === "loan");

export function personalSummary(rows: PersonalRow[]) {
  return [...new Set(rows.map((r) => r.record.currency))].map((currency) => {
    const own = rows.filter((r) => r.record.currency === currency);
    return {
      currency,
      spent: sum(
        own
          .filter((r) => r.kind === "expense")
          .map((r) => BigInt(r.record.amount_minor)),
      ),
      lent: sum(own.map((r) => (r.kind === "loan" ? pos(r.left) : 0n))),
    };
  });
}

/** Money you still owe on loans, kept apart from Group's expense figures. */
export const borrowedLoans = (ledger: ActivityLedger, me: number) =>
  ledger.loans.filter((l) => l.to_user_id === me);
