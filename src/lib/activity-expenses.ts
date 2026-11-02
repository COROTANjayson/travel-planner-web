import type { ActivityLedger, Expense, Share } from "./expenses";

export function memberPaymentState(
  cost: Expense,
  ledger: ActivityLedger,
  userID: number,
) {
  const share = BigInt(
    cost.shares.find((s) => s.user_id === userID)?.amount_minor ?? "0",
  );
  const remainingBusiness = BigInt(
    uncovered(cost, ledger).find((s) => s.user_id === userID)?.amount_minor ??
      "0",
  );
  const payments = ledger.payments.filter((p) => p.expense_id === cost.id);
  const debts = ledger.debts.filter(
    (d) =>
      d.from_user_id === userID && payments.some((p) => p.id === d.payment_id),
  );
  const reimbursement = debts.reduce(
    (n, d) => n + (BigInt(d.amount_minor) > 0n ? BigInt(d.amount_minor) : 0n),
    0n,
  );
  const receivable = ledger.debts
    .filter(
      (d) =>
        d.to_user_id === userID && payments.some((p) => p.id === d.payment_id),
    )
    .reduce(
      (n, d) => n + (BigInt(d.amount_minor) > 0n ? BigInt(d.amount_minor) : 0n),
      0n,
    );
  const business = remainingBusiness > 0n ? remainingBusiness : 0n;
  const remaining = business + reimbursement;
  const paid = share > remaining ? share - remaining : 0n;
  const credit =
    (remainingBusiness < 0n ? -remainingBusiness : 0n) +
    debts.reduce(
      (n, d) =>
        n + (BigInt(d.amount_minor) < 0n ? -BigInt(d.amount_minor) : 0n),
      0n,
    );
  return {
    share,
    business,
    remaining,
    paid,
    debts,
    receivable,
    credit,
    status:
      credit > 0n
        ? "Credit for review"
        : remaining === 0n
          ? "Paid"
          : paid > 0n
            ? "Partially paid"
            : "Not paid",
  };
}

export function uncovered(cost: Expense, ledger: ActivityLedger): Share[] {
  const values = new Map(
    cost.shares.map((s) => [s.user_id, BigInt(s.amount_minor)]),
  );
  for (const p of ledger.payments.filter((p) => p.expense_id === cost.id)) {
    for (const s of p.allocations)
      values.set(
        s.user_id,
        (values.get(s.user_id) ?? 0n) - BigInt(s.amount_minor),
      );
  }
  return [...values]
    .sort(([a], [b]) => a - b)
    .map(([user_id, value]) => ({ user_id, amount_minor: value.toString() }));
}

export function allocatePayment(
  amount: string,
  payer: number,
  shares: Share[],
): Share[] {
  let rest = BigInt(amount);
  const values = shares
    .map((s) => ({
      user_id: s.user_id,
      value: BigInt(s.amount_minor) > 0n ? BigInt(s.amount_minor) : 0n,
    }))
    .sort((a, b) => a.user_id - b.user_id);
  let total = values.reduce((n, s) => n + s.value, 0n);
  if (rest <= 0n || rest > total)
    throw new Error(
      "Enter a positive payment within the remaining business amount.",
    );
  const own = values.find((s) => s.user_id === payer);
  const first = own ? (own.value < rest ? own.value : rest) : 0n;
  if (own) own.value -= first;
  total -= first;
  rest -= first;
  const result = values.map((s) => ({
    user_id: s.user_id,
    value:
      (rest && total ? (rest * s.value) / total : 0n) +
      (s.user_id === payer ? first : 0n),
  }));
  let remainder = BigInt(amount) - result.reduce((n, s) => n + s.value, 0n);
  for (let i = 0; i < result.length && remainder > 0n; i++) {
    if (
      result[i].value <
      values[i].value + (result[i].user_id === payer ? first : 0n)
    ) {
      result[i].value++;
      remainder--;
    }
  }
  return result
    .filter((s) => s.value > 0n)
    .map((s) => ({ user_id: s.user_id, amount_minor: s.value.toString() }));
}

export function personalTotals(
  ledger: ActivityLedger,
  user: number,
  currency: string,
  activity?: string,
) {
  const matches = (x: {
    currency: string;
    activity_id?: number;
    activity_name?: string;
  }) => x.currency === currency && (!activity || activityKey(x) === activity);
  const costs = ledger.expenses.filter(matches);
  const cost = costs.reduce(
    (n, e) =>
      n + BigInt(e.shares.find((s) => s.user_id === user)?.amount_minor ?? "0"),
    0n,
  );
  let business = 0n,
    businessCredit = 0n;
  for (const e of costs) {
    const value = BigInt(
      uncovered(e, ledger).find((s) => s.user_id === user)?.amount_minor ?? "0",
    );
    if (value > 0n) business += value;
    else businessCredit -= value;
  }
  const debts = ledger.debts.filter(matches);
  let owe = 0n,
    owed = businessCredit;
  for (const d of debts) {
    const value = BigInt(d.amount_minor);
    if (d.from_user_id === user) {
      if (value > 0n) owe += value;
      else owed -= value;
    }
    if (d.to_user_id === user) {
      if (value > 0n) owed += value;
      else owe -= value;
    }
  }
  const unallocated = ledger.settlements
    .filter((s) => !s.payment_id && !s.loan_id && s.currency === currency)
    .reduce(
      (n, s) =>
        n +
        (s.from_user_id === user ? BigInt(s.amount_minor) : 0n) -
        (s.to_user_id === user ? BigInt(s.amount_minor) : 0n),
      0n,
    );
  return {
    cost,
    business,
    businessCredit,
    owe,
    owed,
    unallocated,
    remaining: business + owe,
  };
}
export function activityKey(x: {
  activity_id?: number;
  activity_name?: string;
}) {
  return x.activity_id
    ? String(x.activity_id)
    : x.activity_name
      ? `removed:${x.activity_name}`
      : "unassigned";
}
